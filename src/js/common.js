// === common.js ===

// 💖 同期中にページを離れようとしたら警告を出す
window.addEventListener('beforeunload', (e) => {
  if (window.isSyncing) {
    e.preventDefault();
    e.returnValue = ''; // Chromeではメッセージは表示されませんが、ダイアログは出ます
  }
});

async function startGlobalSync() {
  if (window.isSyncing) return;
  
  window.isSyncing = true;
  window.shouldCancelSync = false;
  syncStatusText = 'Starting...';
  
  const t = I18N[currentLang];
  updateSyncUI({ inProgress: true });

  // 💖 UI更新ループ (requestAnimationFrame)
  // 描画のタイミングに合わせてDOMを更新することで、パフォーマンスを最適化します
  const updateLoop = () => {
    if (!window.isSyncing) return;
    const statusEl = document.getElementById('global-sync-status');
    if (statusEl) {
        const newText = `🔄 ${syncStatusText}`;
        if (statusEl.textContent !== newText) statusEl.textContent = newText;
    }
    requestAnimationFrame(updateLoop);
  };
  requestAnimationFrame(updateLoop);

  try {
    // db.js の関数を直接呼び出し
    // コールバックでは変数だけを更新する（超軽量）
    const result = await syncDataBackground((status) => {
      syncStatusText = status;
    });
    
    if (result && !result.cancelled) {
       if (typeof onSyncComplete === 'function') {
         onSyncComplete(result);
       }
    }
  } catch (e) {
    console.error(e);
    alert("Sync Error: " + e.message);
  } finally {
    window.isSyncing = false;
    updateSyncUI({ inProgress: false });
    const statusEl = document.getElementById('global-sync-status');
    if (statusEl) statusEl.textContent = '';
  }
}

function cancelGlobalSync() {
  window.shouldCancelSync = true;
  syncStatusText = 'Cancelling...';
}

function updateSyncUI({ inProgress }) {
  const btn = document.getElementById('btn-global-sync');
  if (!btn) return;

  const t = I18N[currentLang];
  
  btn.textContent = inProgress ? t.btnSyncCancel : t.btnSync;
  btn.onclick = inProgress ? cancelGlobalSync : startGlobalSync;
  btn.classList.toggle('sync-cancel', inProgress);
  btn.disabled = false; // ボタンは常に有効（中止できるように）
}

// 💖 設定をlocalStorageから読み込みます
function loadSettings() {
  const savedTheme = localStorage.getItem('theme');
  const savedLang = localStorage.getItem('lang');

  // テーマの読み込み（なければブラウザ設定から）
  const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  currentTheme = savedTheme || defaultTheme;

  // 言語の読み込み（なければブラウザ設定から）
  const defaultLang = navigator.language.startsWith('ja') ? 'ja' : 'en';
  currentLang = savedLang || defaultLang;
}

// グローバルな状態管理
let currentTheme, currentLang;
loadSettings();

// 初期テーマをHTMLに適用
document.documentElement.setAttribute('data-theme', currentTheme);

function toggleThemeGlobal() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', currentTheme); // 💖 設定を保存
  document.documentElement.setAttribute('data-theme', currentTheme);
  // 各ページに存在する updateUI() を呼び出してテキストを更新
  if (typeof updateUI === 'function') updateUI();
}

/**
 * 日本語/英語を切り替えるグローバル関数
 */
function toggleLanguage() {
  currentLang = currentLang === 'ja' ? 'en' : 'ja';
  localStorage.setItem('lang', currentLang); // 💖 設定を保存
  // 各ページに存在する updateUI() を呼び出してUIを更新
  if (typeof updateUI === 'function') updateUI();
}

function getMsg(key, ...args) {
  let msg = (I18N[currentLang] && I18N[currentLang][key]) || key;
  args.forEach((arg, i) => {
    msg = msg.replace(`{${i}}`, arg);
  });
  return msg;
}

// 💖 アプリ更新時の自動メンテナンス機能（共通化）
async function checkAppVersion() {
  const savedVersion = localStorage.getItem('app_version');
  // バージョンが変わっていたら（または未設定なら）、強制的にデータをリセットして不整合を防ぎます
  if (savedVersion != CONFIG.APP_VERSION) {
    console.log(`App updated: ${savedVersion} -> ${CONFIG.APP_VERSION}. Cleaning up...`);
    
    // 1. ローカルDB(IndexedDB)をクリア
    try { await clearDB(); } catch(e) { console.error(e); }

    // 2. 設定の「最終同期日時」と「エラーリスト」をリセット
    const settingsStr = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        settings.spaces.forEach(s => s.projects.forEach(p => {
          p.last_fetch = null;
          p.failed_issues = [];
        }));
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
        
        // 設定済みユーザーには通知を出す
        if (settings.spaces.length > 0) {
          alert(getMsg('msgAppUpdated'));
        }
      } catch(e) { console.error(e); }
    }
    // 3. 新しいバージョンを記録
    localStorage.setItem('app_version', CONFIG.APP_VERSION);
  }
}

// 💖 検索条件・UI操作の共通ロジッククラス
const SearchLogic = {
  // 管理する入力項目のIDリスト
  inputIds: ['space-input', 'proj-input', 'status-input', 'type-input', 'assignee-input', 'due-input', 'due-mode', 'keyword-input'],
  
  // 全データ（キャッシュ）への参照
  allData: [],

  // 初期化
  init(data) {
    this.allData = data || [];
    this.enhanceDatalistInputs();
    this.setupDependencyListeners();
    this.populateDropdowns();
    this.loadState(); // 画面ロード時に復元
    this.bindAutoSave(); // 入力変更時に自動保存
  },

  // 入力変更を監視して自動保存
  bindAutoSave() {
    this.inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // change: 確定時, input: 入力中 (テキストボックスなど)
        el.addEventListener('change', () => this.saveState());
        el.addEventListener('input', () => this.saveState());
      }
    });
  },

  // 状態の保存
  saveState() {
    const state = {};
    this.inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) state[id] = el.value;
    });
    localStorage.setItem('backlog_search_ui_state', JSON.stringify(state));
  },

  // 状態の復元
  loadState() {
    const json = localStorage.getItem('backlog_search_ui_state');
    if (!json) return;
    try {
      const state = JSON.parse(json);
      this.inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && state[id] !== undefined) {
          el.value = state[id];
        }
      });
      // プロジェクトリストなどはスペースの値に依存するので更新
      if (state['space-input']) {
        this.updateProjectList(state['space-input']);
      }
      this.updateDependentDropdowns();
    } catch (e) {
      console.error("Failed to load search state", e);
    }
  },

  // プルダウン（datalist）の生成
  populateDropdowns() {
    const spaces = new Set();

    this.allData.forEach(d => {
      if(d.space) spaces.add(d.space);
    });

    const fillList = (id, set) => {
      const dl = document.getElementById(id);
      if(!dl) return;
      dl.innerHTML = '';
      Array.from(set).sort((a, b) => a.localeCompare(b, 'ja')).forEach(v => dl.appendChild(new Option(v)));
    };

    fillList('space-list', spaces);
    this.updateProjectList(document.getElementById('space-input')?.value);
    
    // 💖 依存関係のあるプルダウンを更新
    this.updateDependentDropdowns();
  },

  updateProjectList(spaceName) {
    const dl = document.getElementById('proj-list');
    if (!dl) return;
    dl.innerHTML = '';
    
    const projs = new Set();
    const targetData = spaceName ? this.allData.filter(d => d.space === spaceName) : this.allData;
    
    targetData.forEach(d => {
      if (d.project) projs.add(d.project);
    });

    Array.from(projs).sort((a, b) => a.localeCompare(b, 'ja')).forEach(v => dl.appendChild(new Option(v)));
  },

  // 💖 新規追加: スペースやプロジェクトの選択状況に応じて、他のプルダウンの中身を絞り込む
  updateDependentDropdowns() {
    const spaceInput = document.getElementById('space-input');
    const projInput = document.getElementById('proj-input');
    const spaceName = spaceInput ? spaceInput.value : '';
    const projectName = projInput ? projInput.value : '';

    let targetData = this.allData;
    
    if (spaceName) {
      targetData = targetData.filter(d => d.space === spaceName);
    }
    if (projectName) {
      targetData = targetData.filter(d => d.project === projectName);
    }

    const statuses = new Set();
    const types = new Set();
    const assignees = new Set();

    targetData.forEach(d => {
      if(d.status) statuses.add(d.status);
      if(d.type) types.add(d.type);
      if(d.assignee) assignees.add(d.assignee);
    });

    const fillList = (id, set) => {
      const dl = document.getElementById(id);
      if(!dl) return;
      dl.innerHTML = '';
      Array.from(set).sort((a, b) => a.localeCompare(b, 'ja')).forEach(v => dl.appendChild(new Option(v)));
    };

    fillList('type-list', types);
    fillList('assignee-list', assignees);

    // ステータス
    const statusDl = document.getElementById('status-list');
    if (statusDl) {
      statusDl.innerHTML = '';
      const phAllText = getMsg('phAll');
      statusDl.appendChild(new Option(phAllText));
      
      const sortedStatuses = Array.from(statuses).sort((a, b) => {
        const indexA = CONFIG.STATUS_ORDER.indexOf(a);
        const indexB = CONFIG.STATUS_ORDER.indexOf(b);
        if (indexA > -1 && indexB > -1) return indexA - indexB;
        if (indexA > -1) return -1;
        if (indexB > -1) return 1;
        return a.localeCompare(b, 'ja');
      });
      sortedStatuses.forEach(v => statusDl.appendChild(new Option(v)));
    }
  },

  setupDependencyListeners() {
    const spaceInput = document.getElementById('space-input');
    const projInput = document.getElementById('proj-input');

    if (spaceInput) {
      spaceInput.addEventListener('input', () => {
        this.updateProjectList(spaceInput.value);
        this.updateDependentDropdowns();
      });
    }

    if (projInput) {
      projInput.addEventListener('input', () => {
         this.updateDependentDropdowns();
      });

      projInput.addEventListener('change', () => {
        const val = projInput.value;
        if (!val) {
             this.updateDependentDropdowns();
             return;
        }
        const match = this.allData.find(d => d.project === val);
        if (match && match.space && spaceInput.value !== match.space) {
          spaceInput.value = match.space;
          this.updateProjectList(match.space);
          // スペースが変わったので保存
          this.saveState();
        }
        this.updateDependentDropdowns();
      });
    }
  },

  enhanceDatalistInputs() {
    this.inputIds.forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      
      const resetBtn = input.parentElement ? input.parentElement.querySelector('.btn-reset') : null;
      const hasDatalist = input.hasAttribute('list');
      let valueBeforeFocus = '';

      if (hasDatalist) {
        input.addEventListener('focus', function() {
          valueBeforeFocus = this.value;
          this.value = '';
        });
        input.addEventListener('blur', function() {
          if (this.value === '') this.value = valueBeforeFocus;
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = '';
          if (hasDatalist) valueBeforeFocus = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          this.saveState(); // クリア時も保存
        });
      }
    });
  },
  
  // 💖 AI用にテキストを無害化する共通関数
  sanitizeTextForAI(text) {
    if (!text) return "";
    // URL検出ロジックを強化
    const urlRegex = /((https?:\/\/)|(www\.))[^\s`()\[\]{}<>"']+/g;
    
    return text.replace(urlRegex, (match) => {
      // 末尾が句読点(.,:;!?)なら、それはURLに含めず文章の一部として残す
      if (/[.,:;!?]$/.test(match)) return '[外部リンク]' + match.slice(-1);
      return '[外部リンク]';
    });
  },

  // 検索条件オブジェクトを生成して返す
  getConditions() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : null;
    };

    let inputStatus = getVal('status-input') || "";
    
    return {
      space: getVal('space-input'),
      proj: getVal('proj-input'),
      status: inputStatus,
      type: getVal('type-input'),
      assignee: getVal('assignee-input'),
      dueSince: getVal('due-mode') === 'since' ? getVal('due-input') : null,
      dueUntil: getVal('due-mode') === 'until' ? getVal('due-input') : null,
      keyword: getVal('keyword-input'),
      keywordMode: "AND"
    };
  }
};