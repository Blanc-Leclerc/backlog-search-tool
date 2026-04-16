// === config.js ===
const CONFIG = {
  STORAGE_KEY: 'backlog_saas_settings',
  DB_NAME: 'BacklogSaaSDB',
  DB_STORE_NAME: 'issues',
  DB_VERSION: 1,
  APP_VERSION: 1,       // 💖 データ構造の変更や、全再取得が必要な時だけ数値を上げてください（UI変更のみならそのままでOK）
  DEFAULT_PARALLEL: 5,  // 初期値は安全運転でスタート
  MAX_PARALLEL: 30,     // 調子が良いときはここまで増やす
  MIN_PARALLEL: 1,      // 調子が悪いときはここまで減らす
  FETCH_LIMIT: 100,
  // 💖 プルダウン内の「状態」の並び順を定義します
  STATUS_ORDER: [
    // Japanese
    "未対応", "処理中", "処理済み", "完了",
    // English
    "Open", "In Progress", "Resolved", "Closed"
  ]
};

// 💖 アラートやポップアップの文言を含めた完全版辞書！
const I18N = {
  ja: {
    themeDark: '🌙 Dark', themeLight: '☀️ Light',
    
    // --- setup.html 用 ---
    setupTitle: '初期設定 (Setup)',
    btnSettings: '⚙️ 設定',
    btnBack: '🔙 検索画面へ',
    lblPane1: '🏢 ダッシュボードとプロジェクトの登録',
    lblHost: 'ダッシュボードURL (Host)',
    phHost: '例: xxx.backlog.com',
    lblApiKey: 'APIキー',
    phApiKey: 'API Key',
    linkHelp: '💡 APIキーの発行手順はこちら',
    btnAddSpace: '➕ ダッシュボードを登録',
    lblRegSpaces: '【登録済みダッシュボード一覧】',
    lblSelectSpace: '対象のダッシュボードを選択',
    phSelectSpace: '（まずはダッシュボードを登録）',
    btnFetch: '📥 プロジェクトを取得',
    btnFetchLoading: '📥 取得中...',
    lblAddProj: '追加するプロジェクトをお選びください：',
    btnSelAll: '☑ 全選択',
    btnDeselAll: '☐ 全解除',
    btnSaveProj: '💾 選択したプロジェクトを登録',
    lblTreeTitle: '📂 登録済み構成（ツリービュー）',
    btnDelSelected: '🗑️ 選択した項目を削除',
    btnDelLoading: '🗑️ 削除中...',
    btnClearDB: '🔥 ローカルデータを全削除',
    lblSyncTarget: '同期',
    
    // setup.html のポップアップ（アラート・コンファーム）
    msgErrHostApi: 'ホストとAPIキーのご入力をお願いいたします。',
    msgErrSpaceExist: 'そのダッシュボードは既に登録されておりますわ。',
    msgSpaceAdded: 'ダッシュボードを登録いたしました！',
    msgWarnDelSpace: '削除するスペースをお選びくださいませ。',
    msgConfDelSpace: '選択された {0} 件のダッシュボードと、関連する全てのデータを削除してもよろしいですか？',
    msgSpaceDeleted: 'ダッシュボードを削除いたしました。',
    msgErrNoSpace: 'ダッシュボードが選択されておりませんわ。',
    msgErrFetchProj: '申し訳ございません、プロジェクトの取得に失敗いたしました。\n',
    msgProjAdded: 'プロジェクトを登録いたしました！検索画面からデータの取得を始めていただけますわ。',
    msgWarnDelItem: '削除する項目をお選びくださいませ。',
    msgConfDelItem: '選択された項目と、保存されたデータを削除してもよろしいですか？',
    msgItemDeleted: '✅ 削除いたしました！',
    msgConfClearDB: '保存されている全てのチケットデータを破棄し、最初からやり直しますか？',
    msgDBCleared: 'キャッシュを全て綺麗にいたしました！',
    msgAppUpdated: '✨ アプリが更新されましたわ！\nデータの整合性を保つため、一度ローカルデータをリセットいたしました。\nお手数ですが、再度「同期」ボタンを押してデータを取得してくださいませ。',

    // --- search.html 用 ---
    searchTitle: 'Backlog 検索ツール',
    lblSpace: 'ダッシュボード:', phSpace: '（全て）',
    phAll: '（全て）',
    lblProj: 'プロジェクト:', phProj: '（全て）',
    lblStatus: '状態:', phStatus: '完了以外',
    lblType: '種別:', phType: '（全て）',
    lblAssignee: '担当者:', phAssignee: 'A様',
    lblKeyword: 'キーワード:', phKeyword: 'スペース区切りでAND検索いたします',
    lblDueDate: '期日:',
    optSince: '以降',
    optUntil: '以前',
    btnSearch: '🔍 検索',
    btnClear: '🗑️ クリア',
    btnHint: '💡',
    btnCopySingle: '🤖 AI用にコピー',
    navSearch: '🔍 検索',
    navSettings: '⚙️ 設定',
    lblDetail: '詳細・ヒット箇所',
    msgDetailBase: '左側のリストからチケットをお選びくださいませ。',
    thKey: 'キー', thSum: '件名', thStatus: '状態', thAssign: '担当者', thDue: '期日', thUpd: '更新日',
    lblCount: '検索結果：{0}件',
    msgSearching: '🔍 ただいま検索しております...',
    btnSync: '🔄 データの最新化',
    btnSyncing: '🔄 データ取得中...',
    btnSyncCancel: '⏹️ 同期を中止',
    
    // search.html のポップアップ
    msgSetupFirst: 'まずは初期設定をお願いいたしますわ。',
    msgSyncDone: '✨ データの更新が完了いたしましたわ！',
    msgCopied: 'コピーいたしました！',
    msgNoData: 'データがございませんわ。検索してから押してくださいませ。',
    msgCommentPartFail: '⚠️ 一部のコメントが取得できませんでした。再同期をお試しくださいませ。',
    msgCommentAllFail: '⚠️ コメントを取得できませんでした。',
    msgCommentFailDesc: '再同期を行うことで解決する場合がございます。お手数ですがお試しくださいませ。',
    linkText: '🔗 何かのリンクですわ！',
    msgSearchHints: '<h3>💡 検索のコツ (Search Tips)</h3><ul style="list-style-type: none; padding-left: 10px; line-height: 1.6;"><li><b>📌 AND検索</b><br>キーワードをスペースで区切ると、すべての語句を含むチケットを検索します。<br>例：「エラー 画面」</li><li style="margin-top:10px;"><b>📌 ブラウザ内検索との合わせ技</b><br>このツールで大まかに絞り込んだ後、ブラウザの検索機能（Ctrl+F）を使うと、ハイライトされた箇所をさらに高速に探せますわ！</li><li style="margin-top:10px;"><b>📌 ダブルクリックでBacklogへ</b><br>検索結果の行をダブルクリックすると、Backlogの該当チケットページを直接開くことができますの。</li><li style="margin-top:10px;"><b>📌 リンクの活用</b><br>詳細画面のリンクは新しいタブで開きます。気になったらどんどん開いて確認しましょう。</li></ul>'
  },
  en: {
    themeDark: '🌙 Dark', themeLight: '☀️ Light',
    
    // --- setup.html 用 ---
    setupTitle: 'Initial Setup',
    btnSettings: '⚙️ Settings',
    btnBack: '🔙 Return to Search',
    lblPane1: '🏢 Register Dashboard & Projects',
    lblHost: 'Dashboard URL (Host)',
    phHost: 'e.g. xxx.backlog.com',
    lblApiKey: 'API Key',
    phApiKey: 'Your API Key',
    linkHelp: '💡 Guide to issue API Key',
    btnAddSpace: '➕ Register Dashboard',
    lblRegSpaces: '【Registered Dashboards】',
    lblSelectSpace: 'Select Target Dashboard',
    phSelectSpace: '(Please register a dashboard first)',
    btnFetch: '📥 Fetch Projects',
    btnFetchLoading: '📥 Fetching data...',
    lblAddProj: 'Select projects to add:',
    btnSelAll: '☑ Select All',
    btnDeselAll: '☐ Deselect All',
    btnSaveProj: '💾 Register Selected Projects',
    lblTreeTitle: '📂 Registered Configuration (Tree View)',
    btnDelSelected: '🗑️ Remove Selected Items',
    btnDelLoading: '🗑️ Removing...',
    btnClearDB: '🔥 Discard All Local Data',
    lblSyncTarget: 'Sync',
    
    // setup.html のポップアップ（アラート・コンファーム）
    msgErrHostApi: 'Would you kindly enter both Host and API Key?',
    msgErrSpaceExist: 'This dashboard is already registered, My Lady.',
    msgSpaceAdded: 'The dashboard has been registered successfully.',
    msgWarnDelSpace: 'Please select the spaces you wish to remove.',
    msgConfDelSpace: 'Do you really wish to remove {0} selected dashboard(s) and all related data?',
    msgSpaceDeleted: 'Dashboards have been removed.',
    msgErrNoSpace: 'No dashboard is selected.',
    msgErrFetchProj: 'I am afraid I failed to fetch the projects.\n',
    msgProjAdded: 'Projects have been registered. You may now proceed to fetch data.',
    msgWarnDelItem: 'Please select items to remove.',
    msgConfDelItem: 'Do you wish to delete selected items and their local data?',
    msgItemDeleted: '✅ Items have been successfully removed.',
    msgConfClearDB: 'Do you wish to discard all local data and start over?',
    msgDBCleared: 'The local cache has been cleared.',
    msgAppUpdated: '✨ The application has been updated!\nLocal data has been reset to ensure integrity.\nPlease click the "Sync" button to fetch the latest data.',

    // --- search.html 用 ---
    searchTitle: 'Backlog Search Tool',
    lblSpace: 'Dashboard:', phSpace: '(All)',
    phAll: '(All)',
    lblProj: 'Project:', phProj: '(All)',
    lblStatus: 'Status:', phStatus: 'Not Closed',
    lblType: 'Type:', phType: '(All)',
    lblAssignee: 'Assignee:', phAssignee: 'Mr. A',
    lblKeyword: 'Keyword:', phKeyword: 'Space-separated AND search',
    lblDueDate: 'Due Date:',
    optSince: 'Since',
    optUntil: 'Until',
    btnSearch: '🔍 Search',
    btnClear: '🗑️ Clear',
    btnHint: '💡',
    btnCopySingle: '🤖 Copy Issue for AI',
    navSearch: '🔍 Search',
    navSettings: '⚙️ Settings',
    lblDetail: 'Details & Hits',
    msgDetailBase: 'Please select an issue from the list.',
    thKey: 'Key', thSum: 'Summary', thStatus: 'Status', thAssign: 'Assignee', thDue: 'Due', thUpd: 'Updated',
    lblCount: 'Results: {0} items',
    msgSearching: '🔍 Searching...',
    btnSync: '🔄 Sync Data',
    btnSyncing: '🔄 Syncing...',
    btnSyncCancel: '⏹️ Cancel Sync',
    
    // search.html のポップアップ
    msgSetupFirst: 'Please complete the initial setup first, My Lady.',
    msgSyncDone: '✨ Data synchronization is complete.',
    msgCopied: 'It has been copied.',
    msgNoData: 'There is no data, My Lady.',
    msgCommentPartFail: '⚠️ Some comments could not be retrieved. Please try syncing again.',
    msgCommentAllFail: '⚠️ Comments could not be retrieved.',
    msgCommentFailDesc: 'This may be resolved by performing a re-sync. Please give it a try.',
    linkText: '🔗 Link',
    msgSearchHints: '<h3>💡 Search Tips</h3><ul style="list-style-type: none; padding-left: 10px; line-height: 1.6;"><li><b>📌 AND Search</b><br>Separate keywords with spaces to find issues containing all terms.<br>e.g. "error screen"</li><li style="margin-top:10px;"><b>📌 Combine with Browser Search</b><br>After filtering with this tool, use your browser\'s find function (Ctrl+F) to quickly locate highlighted terms!</li><li style="margin-top:10px;"><b>📌 Double-Click to Backlog</b><br>You can double-click a row in the search results to open the corresponding ticket page on Backlog directly.</li><li style="margin-top:10px;"><b>📌 Use Links</b><br>Links in the detail view open in new tabs. Feel free to open them to check details.</li></ul>'
  }
};