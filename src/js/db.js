// === db.js ===

// 💖 429・ネットワークエラー時にリトライするfetchヘルパー
async function fetchWithRetry(url, maxRetry = 5) {
  let retry = 0;
  while (retry < maxRetry) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000 * (retry + 1)));
        retry++;
        continue;
      }
      return res;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000 * (retry + 1)));
      retry++;
    }
  }
  throw new Error('fetch failed after max retries');
}

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CONFIG.DB_STORE_NAME)) {
        const store = db.createObjectStore(CONFIG.DB_STORE_NAME, { keyPath: "key" });
        store.createIndex("space", "space", { unique: false });
        store.createIndex("project", "project", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("assignee", "assignee", { unique: false });
        store.createIndex("updated", "updated", { unique: false });
        store.createIndex("dueDate", "dueDate", { unique: false }); 
        store.createIndex("mentions", "mentions", { unique: false, multiEntry: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject("DB Error: " + event.target.error);
  });
}

// 💖 これが赤い自爆ボタンの正体です！内部のキャッシュだけを綺麗に全削除します！
async function clearDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG.DB_STORE_NAME], "readwrite");
    const store = transaction.objectStore(CONFIG.DB_STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteIssuesByProject(space, projectKey) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG.DB_STORE_NAME], "readwrite");
    const store = transaction.objectStore(CONFIG.DB_STORE_NAME);
    const index = store.index("project");
    const request = index.openCursor(IDBKeyRange.only(projectKey));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.space === space) {
          cursor.delete();
        }
        cursor.continue(); 
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject("削除エラー: " + e.target.error);
  });
}

async function saveIssuesToDB(issuesArray) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG.DB_STORE_NAME], "readwrite");
    const store = transaction.objectStore(CONFIG.DB_STORE_NAME);
    issuesArray.forEach(issue => store.put(issue));
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}

// 💖 単体の課題メタデータを取得するヘルパー関数
async function fetchIssueMetadata(host, apiKey, issueKey) {
  const res = await fetch(`https://${host}/api/v2/issues/${issueKey}?apiKey=${apiKey}`);
  if (res.status === 404) return null; // 削除されていた場合はnullを返す
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchAndFormatIssue(host, apiKey, issue, forceProjKey) {
  let formattedComments = [];
  let commentsText = ""; 
  let mentionsSet = new Set();
  let hasFetchError = false; // 💖 エラー発生フラグ
  const mentionRegex = /@[^\s　]+/g;

  const description = issue.description || "";
  const descMentions = description.match(mentionRegex) || [];
  descMentions.forEach(m => mentionsSet.add(m));

  try {
    let allComments = [];
    let minId = 0;

    // 100件ずつループして全件取得
    while (true) {
      let commentsUrl = `https://${host}/api/v2/issues/${issue.issueKey}/comments?apiKey=${apiKey}&count=100&order=asc`;
      if (minId > 0) {
        commentsUrl += `&minId=${minId}`;
      }

      // 💖 fetchWithRetryで429・ネットワークエラーに対応
      let commentsRes = null;
      try {
        commentsRes = await fetchWithRetry(commentsUrl);
      } catch (e) {
        hasFetchError = true;
        break;
      }

      if (!commentsRes || !commentsRes.ok) {
        hasFetchError = true; // 💖 取得失敗としてマーク
        break;
      }

      const chunk = await commentsRes.json();
      if (chunk.length === 0) break;

      allComments.push(...chunk);

      // 次の取得のために最後のID+1をセット
      const lastComment = chunk[chunk.length - 1];
      if (lastComment && lastComment.id) {
        minId = lastComment.id + 1;
      }

      // 100件未満ならこれ以上データはないので終了
      if (chunk.length < 100) break;
    }

    let commentNo = 1;
    for (const c of allComments) {
      const content = c.content || "";
      const attachments = c.attachments || [];
      
      // 本文も添付ファイルもない場合はスキップ（状態変更のみのログなど）
      if (!content && attachments.length === 0) continue;

      const createdStr = c.created ? c.created.substring(0, 10) : "";
      const posterStr = c.createdUser ? c.createdUser.name : "";
      const attNames = attachments.map(a => a.name);

      formattedComments.push({ no: commentNo++, created: createdStr, poster: posterStr, content: content, attachments: attNames });
      commentsText += `[${createdStr} ${posterStr}] ${content.replace(/\n/g, " ")} ${attNames.join(" ")} / `;
      const commentMentions = content.match(mentionRegex) || [];
      commentMentions.forEach(m => mentionsSet.add(m));
    }
  } catch (e) {
    console.warn("Comment fetch error", e);
    hasFetchError = true; // 💖 例外発生時もマーク
  }

  return {
    space: host,
    project: forceProjKey, // 英名のプロジェクトキーを強制保存！
    key: issue.issueKey,
    summary: issue.summary || "",
    type: issue.issueType ? issue.issueType.name : "",
    status: issue.status ? issue.status.name : "",
    assignee: issue.assignee ? issue.assignee.name : "",
    created: issue.created ? issue.created.substring(0, 10) : "",
    updated: issue.updated ? issue.updated.substring(0, 10) : "",
    dueDate: issue.dueDate ? issue.dueDate.substring(0, 10) : "",
    description: description,
    comments: formattedComments, 
    comments_text: commentsText, 
    mentions: Array.from(mentionsSet),
    fetch_error: hasFetchError // 💖 DBに保存
  };
}

async function getAllIssuesFromDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG.DB_STORE_NAME], "readonly");
    const store = transaction.objectStore(CONFIG.DB_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function performSearchDB(conditions, cachedData = null) {
  const allData = cachedData || await getAllIssuesFromDB();
  const results = [];
  const { space, proj, status, type, assignee, dueSince, dueUntil, keyword, keywordMode } = conditions;
  const words = keyword ? keyword.trim().split(/[\s　]+/) : [];

  for (const d of allData) {
    // 💖 英語(All)と日本語(全て)の両方に対応！
    if (space && space !== "（全て）" && space !== "(All)" && d.space !== space) continue;
    if (proj && proj !== "（全て）" && proj !== "(All)" && d.project !== proj) continue;
    
    if (status && status !== "（全て）" && status !== "(All)") {
         // Backlog上のステータスが「完了」または「Closed」の場合を除外
         const isClosed = d.status === "完了" || d.status === "Closed";
         if ((status === "完了以外" || status === "Not Closed") && isClosed) continue;
         if ((status !== "完了以外" && status !== "Not Closed") && d.status !== status) continue;
    }
    
    if (type && type !== "（全て）" && type !== "(All)" && d.type !== type) continue;
    
    if (assignee) {
        const isAssignee = d.assignee && d.assignee.toLowerCase().includes(assignee.toLowerCase());
        const isMentioned = d.mentions && d.mentions.some(m => m.toLowerCase().includes(assignee.toLowerCase()));
        if (!isAssignee && !isMentioned) continue;
    }

    // 💖 期日での絞り込みを追加
    if (dueSince && (!d.dueDate || d.dueDate < dueSince)) continue;
    if (dueUntil && (!d.dueDate || d.dueDate > dueUntil)) continue;
    
    if (keyword) {
         const targets = [d.key, d.summary, d.description, d.comments_text].map(t => (t || "").toLowerCase());
         if (keywordMode === "AND") {
             const matchAll = words.every(w => {
                 const lw = w.toLowerCase();
                 return targets.some(t => t.includes(lw));
             });
             if (!matchAll) continue;
         } else {
             const matchAny = words.some(w => {
                 const lw = w.toLowerCase();
                 return targets.some(t => t.includes(lw));
             });
             if (!matchAny) continue;
         }
    }
    results.push(d);
  }
  
  results.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return results;
}

// 💖 復活させた同期関数（メインスレッド版）
async function syncDataBackground(onProgress) {
  const settingsStr = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (!settingsStr) {
    return;
  }
  const settings = JSON.parse(settingsStr);
  let totalFetchedCount = 0;
  const failedProjects = []; // 💖 最終的に失敗したプロジェクトを記録

  for (const space of settings.spaces) {
    if (window.shouldCancelSync) break;
    const host = space.host;
    const apiKey = space.api_key;
    if (!host || !apiKey) continue;

    let allProjects = [];
    try {
      const pRes = await fetchWithRetry(`https://${host}/api/v2/projects?apiKey=${apiKey}`);
      if (pRes.ok) allProjects = await pRes.json();
      else {
        // リトライ後もエラーなら、このスペースの全プロジェクトを失敗扱いにしてスキップ
        space.projects.forEach(p => failedProjects.push(p.key));
        continue;
      }
    } catch(e) {
      space.projects.forEach(p => failedProjects.push(p.key));
      continue;
    }

    for (const proj of space.projects) {
      if (window.shouldCancelSync) break;
      if (proj.sync === false) continue;

      const projKey = proj.key; 
      const lastFetch = proj.last_fetch;
      const failedKeys = proj.failed_issues || [];
      const nextFailedKeys = new Set();
      const issuesMap = new Map();

      const bp = allProjects.find(p => p.projectKey === projKey);
      if (!bp) continue;
      const projId = bp.id;

      try {
        let offset = 0;
        
        if (failedKeys.length > 0) {
          if (onProgress) onProgress(`[${projKey}] Retrying ${failedKeys.length} issues...`);
          for (const key of failedKeys) {
            if (window.shouldCancelSync) break;
            try {
              const meta = await fetchIssueMetadata(host, apiKey, key);
              if (meta) issuesMap.set(meta.issueKey, meta);
            } catch(e) {
              // 💖 404 Not Found (削除済み) などの場合は、次回からリトライしないようにリストから外す
              if (e.message.includes('HTTP 404')) {
              } else {
                // それ以外のエラー（ネットワークエラーなど）は次回もリトライ
                nextFailedKeys.add(key);
              }
            }
          }
        }
        if (window.shouldCancelSync) break;

        let issuesFetchFailed = false;
        while (true) {
          if (window.shouldCancelSync) break;
          if (onProgress) onProgress(`[${projKey}] Fetching... (${totalFetchedCount})`);

          let url = `https://${host}/api/v2/issues?apiKey=${apiKey}&projectId[]=${projId}&count=${CONFIG.FETCH_LIMIT}&offset=${offset}&order=updated`;
          if (lastFetch) url += `&updatedSince=${lastFetch.substring(0, 10)}`;

          let res;
          try {
            res = await fetchWithRetry(url);
          } catch (e) {
            issuesFetchFailed = true;
            break;
          }
          if (!res.ok) { issuesFetchFailed = true; break; }
          const issues = await res.json();
          if (issues.length === 0) break;

          issues.forEach(i => issuesMap.set(i.issueKey, i));
          offset += CONFIG.FETCH_LIMIT;
          totalFetchedCount += issues.length;
          if (issues.length < CONFIG.FETCH_LIMIT) break;
        }
        if (issuesFetchFailed) failedProjects.push(projKey);
        if (window.shouldCancelSync) break;

        const allIssues = Array.from(issuesMap.values());

        if (allIssues.length > 0) {
          const formattedIssues = [];
          let processedCount = 0;
          
          for (const issue of allIssues) {
            if (window.shouldCancelSync) break;
            if (onProgress) onProgress(`[${projKey}] Processing... (${processedCount + 1}/${allIssues.length})`);
            try {
              const formatted = await fetchAndFormatIssue(host, apiKey, issue, projKey);
              formattedIssues.push(formatted);
              if (formatted.fetch_error) nextFailedKeys.add(formatted.key);
            } catch (e) {
              console.error(e);
              // 💖 ここでも同様に、致命的なエラーかどうかを判断
              if (e.message && e.message.includes('HTTP 404')) {
              } else {
                 nextFailedKeys.add(issue.issueKey);
              }
            }
            processedCount++;
          }
          if (window.shouldCancelSync) break;

          if (formattedIssues.length > 0) {
            await saveIssuesToDB(formattedIssues);
          }
        }

        proj.failed_issues = Array.from(nextFailedKeys);
        if (allIssues.length > 0 || failedKeys.length > 0) {
           proj.last_fetch = new Date().toISOString();
        }

      } catch (e) {
         console.error(`Sync error (${projKey}):`, e);
      }
    }
  }

  if (!window.shouldCancelSync) {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
  }
  return { cancelled: window.shouldCancelSync, failedProjects };
}