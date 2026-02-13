const VISION_MONTHLY_LIMIT = 200;
const VISION_COUNT_PREFIX = 'vision_usage_';
const VISION_API_KEY_STORAGE_KEY = 'googleVisionApiKey';

const apiKeyInput = document.getElementById('apiKey');
const keyStatus = document.getElementById('keyStatus');
const usageLabel = document.getElementById('usageLabel');
const message = document.getElementById('message');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const saveKeyBtn = document.getElementById('saveKey');
const deleteKeyBtn = document.getElementById('deleteKey');
const refreshUsageBtn = document.getElementById('refreshUsage');

function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message${type ? ` ${type}` : ''}`;
}

function maskApiKey(key) {
  if (!key || key.length < 10) return '保存済み';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function loadKeyStatus() {
  const data = await chrome.storage.local.get([VISION_API_KEY_STORAGE_KEY]);
  const key = data[VISION_API_KEY_STORAGE_KEY];
  if (key) {
    keyStatus.textContent = `保存済みキー: ${maskApiKey(key)}`;
  } else {
    keyStatus.textContent = 'APIキーは未設定です。';
  }
}

async function loadUsage() {
  const ym = getCurrentYearMonth();
  const usageKey = `${VISION_COUNT_PREFIX}${ym}`;
  const data = await chrome.storage.local.get([usageKey]);
  const used = Number(data[usageKey] || 0);
  usageLabel.textContent = `今月のVision利用: ${used} / ${VISION_MONTHLY_LIMIT}`;
}

toggleVisibilityBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleVisibilityBtn.textContent = isPassword ? '非表示' : '表示';
});

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setMessage('APIキーを入力してください。', 'error');
    return;
  }

  await chrome.storage.local.set({ [VISION_API_KEY_STORAGE_KEY]: key });
  apiKeyInput.value = '';
  apiKeyInput.type = 'password';
  toggleVisibilityBtn.textContent = '表示';
  await loadKeyStatus();
  setMessage('APIキーを保存しました。', 'success');
});

deleteKeyBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove([VISION_API_KEY_STORAGE_KEY]);
  apiKeyInput.value = '';
  await loadKeyStatus();
  setMessage('APIキーを削除しました。', 'success');
});

refreshUsageBtn.addEventListener('click', async () => {
  await loadUsage();
  setMessage('利用状況を更新しました。', 'success');
});

Promise.all([loadKeyStatus(), loadUsage()]);
