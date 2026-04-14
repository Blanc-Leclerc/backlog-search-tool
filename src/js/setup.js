// === setup.js ===

// 💖 同期完了時にService Workerから呼び出されるグローバルコールバック
function onSyncComplete() {
  updateUI(); // ツリービューを再描画して「最終同期日時」などを更新
  setTimeout(() => alert(getMsg('msgSyncDone')), 100);
}

let fetchedProjectsData = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 💖 設定画面から入った場合もメンテナンスを実行
  await checkAppVersion();
  initSettings();
  updateUI(); // 初回描画時に言語を適用
});

// 💖 UIのすべての文字を現在の言語（currentLang）に書き換える関数
function updateUI() {
  const t = I18N[currentLang];
  const settingsStr = localStorage.getItem(CONFIG.STORAGE_KEY);
  const hasSettings = settingsStr && JSON.parse(settingsStr).spaces.some(s => s.projects.length > 0);
  
  document.getElementById('title').textContent = hasSettings ? t.btnSettings : t.setupTitle;
  
  document.getElementById('nav-link-search').textContent = t.navSearch;
  document.getElementById('nav-link-settings').textContent = t.navSettings;
  // 設定がまだない場合は、検索や分析画面に行けないように隠します
  document.getElementById('nav-link-search').style.display = hasSettings ? 'inline-block' : 'none';

  document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? t.themeLight : t.themeDark;
  
  document.getElementById('lbl-pane1').textContent = t.lblPane1;
  document.getElementById('lbl-host').textContent = t.lblHost;
  document.getElementById('new-host').placeholder = t.phHost;
  document.getElementById('lbl-api').textContent = t.lblApiKey;
  document.getElementById('new-apikey').placeholder = t.phApiKey;
  document.getElementById('link-help').textContent = t.linkHelp;
  document.getElementById('btn-add-space').textContent = t.btnAddSpace;
  
  document.getElementById('lbl-select-space').textContent = t.lblSelectSpace;
  document.getElementById('btn-fetch').textContent = t.btnFetch;
  document.getElementById('lbl-add-proj').textContent = t.lblAddProj;
  document.getElementById('btn-save-proj').textContent = t.btnSaveProj;
  document.getElementById('lbl-tree-title').textContent = t.lblTreeTitle;
  document.getElementById('btn-del-selected').textContent = t.btnDelSelected;
  document.getElementById('btn-clear-db').textContent = t.btnClearDB;

  document.querySelectorAll('.btn-sel-all').forEach(b => b.textContent = t.btnSelAll);
  document.querySelectorAll('.btn-desel-all').forEach(b => b.textContent = t.btnDeselAll);

  // リストの再描画（プルダウンの中身の言語も変えるため）
  const settings = settingsStr ? JSON.parse(settingsStr) : { spaces: [] };
  renderConfigTree(settings);
  populateSpaceDropdown(settings);
}

function initSettings() {
  if (!localStorage.getItem(CONFIG.STORAGE_KEY)) {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ spaces: [] }));
  }
}

function addSpace() {
  const host = document.getElementById('new-host').value.trim();
  const apiKey = document.getElementById('new-apikey').value.trim();
  if (!host || !apiKey) return alert(getMsg('msgErrHostApi'));

  let settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
  if (settings.spaces.find(s => s.host === host)) {
    return alert(getMsg('msgErrSpaceExist'));
  }

  settings.spaces.push({ host: host, api_key: apiKey, projects: [] });
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
  
  document.getElementById('new-host').value = "";
  document.getElementById('new-apikey').value = "";
  updateUI();
  alert(getMsg('msgSpaceAdded'));
}

function populateSpaceDropdown(settings) {
  const select = document.getElementById('select-space');
  select.innerHTML = '';
  if (settings.spaces.length === 0) {
    select.innerHTML = `<option value="">${I18N[currentLang].phSelectSpace}</option>`;
    return;
  }
  settings.spaces.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.host;
    opt.textContent = s.host;
    select.appendChild(opt);
  });
}

async function fetchProjects() {
  const host = document.getElementById('select-space').value;
  if (!host) return alert(getMsg('msgErrNoSpace'));

  const settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
  const space = settings.spaces.find(s => s.host === host);
  if (!space) return;

  const btn = document.getElementById('btn-fetch');
  btn.textContent = I18N[currentLang].btnFetchLoading; 
  btn.disabled = true;

  try {
    const res = await fetch(`https://${host}/api/v2/projects?apiKey=${space.api_key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fetchedProjectsData = await res.json();
    
    const container = document.getElementById('fetched-projects-ui');
    container.innerHTML = '';
    fetchedProjectsData.forEach(p => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<label><input type="checkbox" value="${p.projectKey}|||${p.name}" checked> ${p.name} (${p.projectKey})</label>`;
      container.appendChild(div);
    });
    document.getElementById('fetch-result-area').style.display = 'block';
  } catch (e) {
    alert(getMsg('msgErrFetchProj') + e.message);
  } finally {
    btn.textContent = I18N[currentLang].btnFetch; 
    btn.disabled = false;
  }
}

function saveSelectedProjects() {
  const host = document.getElementById('select-space').value;
  const checkboxes = document.querySelectorAll('#fetched-projects-ui input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return;

  let settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
  let space = settings.spaces.find(s => s.host === host);
  if (!space) return;

  checkboxes.forEach(cb => {
    const [key, name] = cb.value.split('|||');
    if (!space.projects.find(p => p.key === key)) {
      // 💖 新規追加時はデフォルトで同期ON (sync: true)
      space.projects.push({ key: key, name: name, last_fetch: null, sync: true });
    }
  });

  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
  document.getElementById('fetch-result-area').style.display = 'none';
  updateUI();
  alert(getMsg('msgProjAdded'));
}

// 💖 ツリービューを描画する関数
function renderConfigTree(settings) {
  const container = document.getElementById('config-tree-ui');
  container.innerHTML = '';
  
  settings.spaces.forEach(space => {
    // ダッシュボード（親）
    const spaceDiv = document.createElement('div');
    spaceDiv.className = 'tree-item tree-space';
    const maskedKey = space.api_key.substring(0, 4) + '****';
    
    // 親チェックボックス
    const spaceCb = document.createElement('input');
    spaceCb.type = 'checkbox';
    spaceCb.value = `SPACE|||${space.host}`;
    spaceCb.onchange = (e) => toggleChildren(space.host, e.target.checked);
    
    const spaceLabel = document.createElement('span');
    spaceLabel.textContent = ` ${space.host} (API: ${maskedKey})`;
    
    spaceDiv.appendChild(spaceCb);
    spaceDiv.appendChild(spaceLabel);
    container.appendChild(spaceDiv);

    // プロジェクト（子）
    space.projects.forEach(proj => {
      const projDiv = document.createElement('div');
      projDiv.className = 'tree-item tree-project';
      
      // 子チェックボックス
      const projCb = document.createElement('input');
      projCb.type = 'checkbox';
      projCb.value = `PROJ|||${space.host}|||${proj.key}`;
      projCb.dataset.parent = space.host; // 親との紐づけ用
      
      const displayName = proj.name ? `${proj.name} (${proj.key})` : proj.key;
      const projLabel = document.createElement('span');
      projLabel.textContent = ` ${displayName}`;
      
      // 同期スイッチ
      const syncToggle = document.createElement('span');
      syncToggle.className = `sync-toggle ${proj.sync !== false ? 'on' : ''}`; // undefinedならtrue扱い
      syncToggle.textContent = `${I18N[currentLang].lblSyncTarget}: ${proj.sync !== false ? 'ON' : 'OFF'}`;
      syncToggle.onclick = () => toggleSync(space.host, proj.key);

      projDiv.appendChild(projCb);
      projDiv.appendChild(projLabel);
      projDiv.appendChild(syncToggle);
      container.appendChild(projDiv);
    });
  });
}

// 💖 親チェックボックス連動
function toggleChildren(host, isChecked) {
  document.querySelectorAll(`input[data-parent="${host}"]`).forEach(cb => cb.checked = isChecked);
}

// 💖 同期設定の切り替え
function toggleSync(host, projKey) {
  let settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
  const space = settings.spaces.find(s => s.host === host);
  if (space) {
    const proj = space.projects.find(p => p.key === projKey);
    if (proj) {
      proj.sync = !proj.sync; // 反転
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
      renderConfigTree(settings); // 再描画
    }
  }
}

// 💖 選択項目の削除（ダッシュボード・プロジェクト混在対応）
async function deleteSelectedItems() {
  const checkboxes = document.querySelectorAll('#config-tree-ui input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return alert(getMsg('msgWarnDelItem'));
  
  if (!confirm(getMsg('msgConfDelItem'))) return;

  const btn = document.getElementById('btn-del-selected');
  btn.textContent = I18N[currentLang].btnDelLoading; 
  btn.disabled = true;
  
  try {
    let settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
    
    for (const cb of checkboxes) {
      const parts = cb.value.split('|||');
      const type = parts[0];
      
      if (type === 'SPACE') {
        const host = parts[1];
        // スペース削除（配下のプロジェクトデータも削除）
        const spaceObj = settings.spaces.find(s => s.host === host);
        if (spaceObj) {
          for (const p of spaceObj.projects) {
            await deleteIssuesByProject(host, p.key);
          }
        }
        settings.spaces = settings.spaces.filter(s => s.host !== host);
      } else if (type === 'PROJ') {
        const host = parts[1];
        const projKey = parts[2];
        // プロジェクト削除（親スペースが削除対象ならスキップ）
        if (!settings.spaces.find(s => s.host === host)) continue;
        
        await deleteIssuesByProject(host, projKey);
        const space = settings.spaces.find(s => s.host === host);
        if (space) space.projects = space.projects.filter(p => p.key !== projKey);
      }
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
    updateUI();
    alert(getMsg('msgItemDeleted'));
  } catch (e) {
    alert("Error: " + e);
  } finally {
    btn.textContent = I18N[currentLang].btnDelSelected; 
    btn.disabled = false;
  }
}

function toggleAll(containerId, isChecked) {
  document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(cb => cb.checked = isChecked);
}

async function clearLocalCache() {
  if(!confirm(getMsg('msgConfClearDB'))) return;
  try {
    await clearDB(); 
    let settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
    settings.spaces.forEach(s => s.projects.forEach(p => p.last_fetch = null));
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
    alert(getMsg('msgDBCleared'));
  } catch(e) {
    alert("Error: " + e);
  }
}