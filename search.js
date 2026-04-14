// === search.js ===

let currentResults = []; 
let selectedIssue = null; 
let currentSort = { key: 'updated', order: 'desc' }; // 💖 デフォルトは更新日の新しい順
let allDataCache = []; // 💖 全データのキャッシュ（連動機能と高速化のため）
let renderRequestId = null; // 💖 描画リクエスト管理用（ちらつき防止）

window.onload = async () => {
  // 💖 共通のメンテナンス処理を実行
  await checkAppVersion();

  const settingsStr = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (!settingsStr || JSON.parse(settingsStr).spaces.length === 0) {
    alert(getMsg('msgSetupFirst'));
    window.location.href = "./setup.html"; 
  } else {
    updateUI();
    initApp();
  }
};

function updateUI() {
  const t = I18N[currentLang];
  
  document.getElementById('title').textContent = t.searchTitle;
  document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? t.themeLight : t.themeDark;
  document.getElementById('nav-link-search').textContent = t.navSearch;
  document.getElementById('nav-link-settings').textContent = t.navSettings;
  
  document.getElementById('lbl-space').textContent = t.lblSpace;
  document.getElementById('space-input').placeholder = t.phSpace;
  document.getElementById('lbl-proj').textContent = t.lblProj;
  document.getElementById('proj-input').placeholder = t.phProj;
  document.getElementById('lbl-status').textContent = t.lblStatus;
  document.getElementById('status-input').placeholder = t.phStatus;
  document.getElementById('lbl-type').textContent = t.lblType;
  document.getElementById('type-input').placeholder = t.phType;
  document.getElementById('lbl-assignee').textContent = t.lblAssignee;
  document.getElementById('assignee-input').placeholder = t.phAssignee;
  document.getElementById('lbl-keyword').textContent = t.lblKeyword;
  document.getElementById('keyword-input').placeholder = t.phKeyword;
  document.getElementById('lbl-due-date').textContent = t.lblDueDate;
  document.getElementById('opt-since').textContent = t.optSince;
  document.getElementById('opt-until').textContent = t.optUntil;

  document.getElementById('btn-search').textContent = t.btnSearch;
  document.getElementById('btn-clear').textContent = t.btnClear;
  document.getElementById('btn-download').textContent = "💾 " + (currentLang === 'ja' ? 'AI用データ保存' : 'Download for AI');
  document.getElementById('btn-csv').textContent = "📊 " + (currentLang === 'ja' ? 'CSV保存' : 'Download CSV');
  document.getElementById('btn-hint').textContent = t.btnHint;
  document.getElementById('btn-copy-single').textContent = t.btnCopySingle;
  document.getElementById('lbl-detail').textContent = t.lblDetail;
  
  // 💖 描画負荷対策：詳細表示のプレースホルダーを更新
  const detailPlaceholder = document.getElementById('detail-placeholder');
  if (detailPlaceholder) detailPlaceholder.textContent = t.msgDetailBase;

  document.getElementById('count-label').textContent = getMsg('lblCount', currentResults.length);
  
  renderTable(); // 💖 言語切り替え時にもヘッダーとテーブルを再描画
  SearchLogic.populateDropdowns(); // 💖 プルダウンの言語も更新

  // 💖 言語切り替え時に詳細表示も更新
  const selectedRow = document.querySelector('#result-tbody tr.selected');
  if (selectedIssue && selectedRow) selectIssue(selectedRow, selectedIssue.key);
}

async function initApp() {
  allDataCache = await getAllIssuesFromDB(); // 💖 起動時にデータをメモリにロード
  SearchLogic.init(allDataCache); // 💖 共通ロジックでUIを初期化・復元
  await performSearch();
}

// 💖 同期完了時にService Workerから呼び出されるグローバルコールバック
async function onSyncComplete() {
  allDataCache = await getAllIssuesFromDB(); // キャッシュを更新
  SearchLogic.init(allDataCache); // UI更新
  performSearch(); // 検索を再実行
  setTimeout(() => alert(getMsg('msgSyncDone')), 100);
}

async function performSearch() {
  // 💖 SearchLogicが自動保存しているので手動保存は不要ですが、念のため
  SearchLogic.saveState();

  const tbody = document.getElementById('result-tbody');
  
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; font-weight: bold; color: var(--primary-color);">${I18N[currentLang].msgSearching}</td></tr>`;
  await new Promise(resolve => setTimeout(resolve, 50));

  let inputStatus = document.getElementById('status-input').value.trim();
  if (inputStatus === "") {
    inputStatus = I18N[currentLang].phStatus; 
  }

  const conditions = SearchLogic.getConditions();
  // デフォルト値の補完
  if (!conditions.status) conditions.status = inputStatus;

  currentResults = await performSearchDB(conditions, allDataCache);

  // 検索直後はデフォルトのソート順（更新日降順）に戻すのが一般的ですが、
  // お好みで前回のソート状態を維持することも可能です。今回はリセットせず維持します。
  renderTable();
}

/**
 * 💖 指定されたキーで結果をソートし、テーブルを再描画します
 */
function sortResults(key) {
  if (currentSort.key === key) {
    // 同じキーなら昇順・降順を反転
    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
  } else {
    // 違うキーなら降順からスタート（日付などは新しい方が上のため）
    currentSort.key = key;
    currentSort.order = 'desc';
  }

  // データのソート
  currentResults.sort((a, b) => {
    let valA = a[currentSort.key] || "";
    let valB = b[currentSort.key] || "";
    
    if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
    if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
    return 0;
  });

  renderTable();
}

/**
 * 💖 現在のデータに基づいてテーブルを描画します (ソートは別関数)
 */
function renderTable() {
  const t = I18N[currentLang];
  const tbody = document.getElementById('result-tbody');
  document.getElementById('count-label').textContent = getMsg('lblCount', currentResults.length);

  // 1. ヘッダーの表示更新（矢印をつける）
  const headers = [
    { key: 'key', id: 'th-key', text: t.thKey },
    { key: 'summary', id: 'th-sum', text: t.thSum },
    { key: 'status', id: 'th-status', text: t.thStatus },
    { key: 'assignee', id: 'th-assign', text: t.thAssign },
    { key: 'dueDate', id: 'th-due', text: t.thDue },
    { key: 'updated', id: 'th-upd', text: t.thUpd }
  ];

  headers.forEach(h => {
    const el = document.getElementById(h.id);
    let label = h.text;
    if (currentSort.key === h.key) {
      label += currentSort.order === 'asc' ? ' ▲' : ' ▼';
      el.style.backgroundColor = 'var(--primary-hover)'; // ソート中の列を少し明るく
    } else {
      el.style.backgroundColor = '';
    }
    el.textContent = label;
  });

  // 3. テーブル本体の描画
  tbody.innerHTML = '';
  if (currentResults.length === 0) return;

  const fragment = document.createDocumentFragment(); // 💖 描画負荷対策：DocumentFragmentで一括追加
  currentResults.forEach(d => {
    const tr = document.createElement('tr'); // 💖 描画負荷対策：createElementで要素を生成
    tr.onclick = () => selectIssue(tr, d.key);
    tr.ondblclick = () => { window.open(`https://${d.space}/view/${d.key}`, '_blank'); };
    
    tr.insertCell().textContent = d.key;
    tr.insertCell().textContent = d.summary;
    tr.insertCell().textContent = d.status;
    tr.insertCell().textContent = d.assignee || '';
    const dueCell = tr.insertCell();
    dueCell.textContent = d.dueDate || '-';
    if (d.dueDate) dueCell.style.cssText = 'color: var(--danger-color); font-weight: bold;';
    tr.insertCell().textContent = d.updated || '-';
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

function formatDetailText(text, keywordStr) {
  if (!text) return "";
  
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\n/g, "<br>");

  // 💖 URL内のダブルクォートをエスケープして、HTML属性を壊さないようにするヘルパー
  const escapeUrl = (url) => url.replace(/"/g, '&quot;');

  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  html = html.replace(mdLinkRegex, (match, label, url) => 
    `<a href="${escapeUrl(url)}" target="_blank" style="color: #0563C1; font-weight: bold; text-decoration: underline;">${label}</a>`
  );

  const backlogLinkRegex = /\[\[(.*?)[>|:](https?:\/\/[^\]]+)\]\]/g;
  html = html.replace(backlogLinkRegex, (match, label, url) => 
    `<a href="${escapeUrl(url)}" target="_blank" style="color: #0563C1; font-weight: bold; text-decoration: underline;">${label}</a>`
  );

  // 💖 URLベタ書きをリンクに変換します。ただし、既にリンクになっているものは除外します。
  const plainUrlRegex = /(https?:\/\/[^\s<]+)(?![^<]*>)/g;
  const linkText = getMsg('linkText');
  html = html.replace(plainUrlRegex, (match, url) => 
    `<a href="${escapeUrl(url)}" target="_blank" style="color: #0563C1; font-style: italic; text-decoration: underline;">${linkText}</a>`
  );

  if (keywordStr) {
    const words = keywordStr.split(/[\s　]+/);
    words.forEach(w => {
      if (!w) return;
      const escapedW = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedW})(?![^<]*>)`, 'gi');
      html = html.replace(regex, '<mark style="background-color: #FFE066; color: #000000; font-weight: bold; border-radius: 2px; padding: 0 2px;">$1</mark>');
    });
  }

  return html;
}

function selectIssue(rowElement, issueKey) {
  // 💖 描画負荷対策：既に選択されている行を再度クリックした場合は何もしない
  if (rowElement && rowElement.classList.contains('selected')) return;

  // 選択行の切り替え（見た目の変更は即座に行う）
  const previouslySelected = document.querySelector('#result-tbody tr.selected');
  if (previouslySelected) previouslySelected.classList.remove('selected');
  if (rowElement) rowElement.classList.add('selected');

  selectedIssue = currentResults.find(r => r.key === issueKey);
  if (!selectedIssue) return;

  // 💖 ちらつき対策：前回の描画待ちがあればキャンセルして、無駄な処理が走らないようにします
  if (renderRequestId) {
    cancelAnimationFrame(renderRequestId);
  }

  // 💖 描画タイミングをブラウザのリフレッシュレートに同期させることで、ちらつきやカクつきを抑えます
  renderRequestId = requestAnimationFrame(() => {
    // 詳細エリアの表示/非表示を切り替える
    document.getElementById('detail-placeholder').style.display = 'none';
    document.getElementById('detail-body').style.display = 'block';

    const currentKeyword = document.getElementById('keyword-input').value.trim();
    
    // 各要素のtextContentを個別に更新
    document.getElementById('detail-key').textContent = selectedIssue.key;
    document.getElementById('detail-summary').textContent = selectedIssue.summary;
    document.getElementById('detail-space').textContent = selectedIssue.space;
    document.getElementById('detail-project').textContent = selectedIssue.project;
    document.getElementById('detail-status').textContent = selectedIssue.status;
    document.getElementById('detail-type').textContent = selectedIssue.type;
    document.getElementById('detail-assignee').textContent = selectedIssue.assignee || '（なし）';
    document.getElementById('detail-created').textContent = selectedIssue.created;
    document.getElementById('detail-updated').textContent = selectedIssue.updated;

    const descContainer = document.getElementById('detail-description');
    descContainer.innerHTML = formatDetailText(selectedIssue.description || "（なし）", currentKeyword);

    // コメント描画
    renderComments(selectedIssue, currentKeyword);
    
    renderRequestId = null; // 処理完了
  });
}

// 💖 描画負荷対策：コメントを効率的に描画する新設関数
function renderComments(issue, keyword) {
  const container = document.getElementById('detail-comments');
  container.innerHTML = ''; // コンテナをクリア

  if (issue.comments && issue.comments.length > 0) {
    const fragment = document.createDocumentFragment(); // 💖 DOM追加を高速化するおまじない
    issue.comments.forEach(c => {
      const header = document.createElement('div');
      header.style.cssText = "color: #4472C4; font-weight: bold; margin-bottom: 3px;";
      header.textContent = `[${c.created} ${c.poster}]`;
      fragment.appendChild(header);

      const content = document.createElement('div');
      content.innerHTML = formatDetailText(c.content, keyword);
      fragment.appendChild(content);

      if (c.attachments && c.attachments.length > 0) {
        const attachmentsDiv = document.createElement('div');
        attachmentsDiv.style.cssText = "margin-top: 5px; padding: 5px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.9em;";
        c.attachments.forEach(fname => {
          const attachP = document.createElement('div');
          attachP.innerHTML = `📎 ${formatDetailText(fname, keyword)}`; // 添付ファイル名もハイライト
          attachmentsDiv.appendChild(attachP);
        });
        fragment.appendChild(attachmentsDiv);
      }
      fragment.appendChild(document.createElement('br'));
    });
    container.appendChild(fragment);

    if (issue.fetch_error) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = "margin-top: 10px; padding: 10px; border: 1px solid var(--danger-color); color: var(--danger-color); background: #FFF0F0; border-radius: 4px; font-weight: bold;";
      errorDiv.textContent = getMsg('msgCommentPartFail');
      container.appendChild(errorDiv);
    }
  } else {
    if (issue.fetch_error) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = "padding: 10px; border: 1px solid var(--danger-color); color: var(--danger-color); background: #FFF0F0; border-radius: 4px;";
      errorDiv.innerHTML = `<strong>${getMsg('msgCommentAllFail')}</strong><br>${getMsg('msgCommentFailDesc')}`;
      container.appendChild(errorDiv);
    } else {
      const noCommentSpan = document.createElement('span');
      noCommentSpan.style.color = 'gray';
      noCommentSpan.textContent = '（なし）';
      container.appendChild(noCommentSpan);
    }
  }
}

function showSearchHints() {
  const modal = document.getElementById('hint-modal');
  const content = document.getElementById('hint-content');
  if (modal && content) {
    // HTMLとしてメッセージを挿入
    content.innerHTML = getMsg('msgSearchHints');
    modal.style.display = 'block';
  }
}

function copySingleJSON() {
  if(!selectedIssue) return;

  const aiData = {
    key: selectedIssue.key,
    summary: selectedIssue.summary,
    status: selectedIssue.status,
    type: selectedIssue.type,
    assignee: selectedIssue.assignee,
    created: selectedIssue.created,
    updated: selectedIssue.updated,
    description: SearchLogic.sanitizeTextForAI(selectedIssue.description),
    comments: selectedIssue.comments.map(c => ({
      date: c.created,
      user: c.poster,
      content: SearchLogic.sanitizeTextForAI(c.content),
      attachments: c.attachments
    }))
  };

  navigator.clipboard.writeText(JSON.stringify(aiData, null, 2))
    .then(() => alert(getMsg('msgCopied')))
}

function downloadAIJSON() {
  if (currentResults.length === 0) return alert(getMsg('msgNoData'));

  // 💖 大量データでもUIが固まらないように、Web Workerに処理を任せます
  const btn = document.getElementById('btn-download');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "💾 " + (currentLang === 'ja' ? '生成中...' : 'Generating...');

  // 1. Workerを生成
  const worker = new Worker('ai-export-worker.js');

  // 2. Workerからのメッセージ（Blob）を待機
  worker.onmessage = function(event) {
    const blob = event.data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlog_search_results_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 後片付け
    btn.disabled = false;
    btn.textContent = originalText;
    worker.terminate(); // Workerを終了
  };

  // Workerでエラーが発生した場合
  worker.onerror = function(error) {
    console.error("Worker error:", error);
    alert("AI用データの生成に失敗しました。");
    btn.disabled = false;
    btn.textContent = originalText;
    worker.terminate();
  };

  // 3. 検索結果データをWorkerに送信して処理を開始
  // 💖 構造化複製アルゴリズムにより、巨大な配列も効率的に転送されます
  worker.postMessage(currentResults);
}

function downloadCSV() {
  if (currentResults.length === 0) return alert(getMsg('msgNoData'));
  
  const t = I18N[currentLang];
  // BOM (Byte Order Mark) を付与して、Excelで文字化けしないようにします
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  
  // ヘッダー行
  const header = [
    t.thKey, t.thSum, t.thStatus, t.thType || 'Type', t.thAssign, t.thDue, t.thUpd
  ];
  
  // データ行の生成（ダブルクォートのエスケープ処理を含む）
  const rows = currentResults.map(d => {
    return [
      d.key, d.summary, d.status, d.type, d.assignee || '', d.dueDate || '', d.updated || ''
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
  });
  
  const csvContent = header.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([bom, csvContent], { type: 'text/csv' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backlog_search_results_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearSearch() {
  const spaceInput = document.getElementById('space-input');
  spaceInput.value = "";
  document.getElementById('proj-input').value = "";
  document.getElementById('status-input').value = "";
  document.getElementById('type-input').value = "";
  document.getElementById('assignee-input').value = "";
  document.getElementById('due-input').value = "";
  document.getElementById('due-mode').value = "since";
  document.getElementById('keyword-input').value = "";

  SearchLogic.saveState(); // 💖 クリアした状態を保存

  // 💖 ダッシュボードの入力欄をクリアした後、連動しているプロジェクトリストも更新するためにイベントを発火させます
  spaceInput.dispatchEvent(new Event('input', { bubbles: true }));
  performSearch();
}

// 💖 ヒントモーダルを閉じる関数
function closeSearchHints() {
  const modal = document.getElementById('hint-modal');
  if (modal) modal.style.display = 'none';
}

// 💖 モーダルの外側をクリックしたら閉じる処理
window.addEventListener('click', function(event) {
  const modal = document.getElementById('hint-modal');
  if (event.target == modal) {
    modal.style.display = "none";
  }
});