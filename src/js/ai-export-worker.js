// === ai-export-worker.js ===
// このファイルは、重たいJSON生成処理をバックグラウンドで実行するための専門の執事です。

// 💖 URLを検知して、AIに優しい形式に置き換えるヘルパー関数です。
// (common.jsにも同じ関数がありますが、Workerはスクリプトを直接参照できないため、こちらにも定義しています)
function sanitizeTextForAI(text) {
  if (!text) return "";
  // 💖 URL検出ロジックを強化
  // 1. http(s) または www. で始まる
  // 2. カッコ()やブラケット[]などは「URLの終わり」とみなす（Markdownなどの誤爆防止）
  const urlRegex = /((https?:\/\/)|(www\.))[^\s`()\[\]{}<>"']+/g;
  
  return text.replace(urlRegex, (match) => {
    // 💖 末尾が句読点(.,:;!?)なら、それはURLに含めず文章の一部として残す
    if (/[.,:;!?]$/.test(match)) return '[外部リンク]' + match.slice(-1);
    return '[外部リンク]';
  });
}

self.onmessage = function(event) {
  const issues = event.data;

  // メインスレッドから受け取ったデータをAIが読みやすい形式に整形します
  const aiData = issues.map(issue => {
    return {
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      type: issue.type,
      assignee: issue.assignee,
      created: issue.created,
      updated: issue.updated,
      description: sanitizeTextForAI(issue.description),
      comments: issue.comments.map(c => ({
        date: c.created,
        user: c.poster,
        content: sanitizeTextForAI(c.content),
        attachments: c.attachments
      }))
    };
  });

  // 整形したデータをJSON文字列に変換し、Blobオブジェクトとして包みます
  // 💖 お嬢様のご懸念通り、改行が多いとファイルが巨大になりすぎます。
  // ここは「1チケット1行」の形式に圧縮しましょう。これなら構造は維持しつつ、行数はチケット数と同じになります。
  // 可読性は下がりますが、AIに渡すデータとしてはこれが最適解ですわ！
  const jsonString = "[\n" + aiData.map(item => JSON.stringify(item)).join(",\n") + "\n]";
  const blob = new Blob([jsonString], { type: 'application/json' });

  // 完成したBlobをメインスレッドに返送します
  self.postMessage(blob);
};