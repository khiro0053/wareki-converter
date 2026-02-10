// サイドパネルのロジック

const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const clearHistoryBtn = document.getElementById('clearHistory');

// 初期ロード
loadHistory();

// 履歴クリアボタン
clearHistoryBtn.addEventListener('click', async () => {
  if (confirm('履歴をすべて削除しますか？')) {
    await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    loadHistory();
  }
});

// backgroundからの更新通知を受信
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'HISTORY_UPDATED') {
    loadHistory();
  }
});

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
  const history = response.history || [];

  if (history.length === 0) {
    historyList.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  historyList.style.display = 'block';
  emptyState.style.display = 'none';

  historyList.innerHTML = history.map(item => createHistoryItem(item)).join('');

  // コピーボタンのイベントリスナー
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const text = e.target.dataset.text;
      navigator.clipboard.writeText(text);
      e.target.textContent = 'コピーしました！';
      setTimeout(() => {
        e.target.textContent = 'コピー';
      }, 2000);
    });
  });
}

function createHistoryItem(item) {
  const date = new Date(item.timestamp);
  const timeStr = date.toLocaleString('ja-JP');
  const urlShort = item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url;

  return `
    <div class="history-item">
      <div class="history-item-header">
        <span class="timestamp">${timeStr}</span>
      </div>
      <div class="conversion-result">
        <div class="original">${escapeHtml(item.original)}</div>
        <div class="arrow">→</div>
        <div class="converted">${escapeHtml(item.converted)}</div>
      </div>
      <div class="history-item-footer">
        <a href="${item.url}" class="url" target="_blank" title="${item.url}">${urlShort}</a>
        <button class="btn-copy" data-text="${escapeHtml(item.converted)}">コピー</button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
