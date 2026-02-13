// Background Service Worker (Manifest V3)

// サイドパネルの履歴データ
let conversionHistory = [];

// インストール時の初期化
chrome.runtime.onInstalled.addListener(() => {
  console.log('和暦⇔西暦変換拡張機能がインストールされました');
  reinjectContentScripts().catch((error) => {
    console.warn('Failed to reinject content scripts on install:', error);
  });
});

// ブラウザ起動時にも既存タブへの再注入を試みる
chrome.runtime.onStartup.addListener(() => {
  reinjectContentScripts().catch((error) => {
    console.warn('Failed to reinject content scripts on startup:', error);
  });
});

// Content Scriptからのメッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    handleScreenshotCapture(message, sender.tab.id)
      .then(sendResponse)
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 非同期レスポンスを示す
  }

  if (message.type === 'GET_HISTORY') {
    sendResponse({ history: conversionHistory });
    return true;
  }

  if (message.type === 'CLEAR_HISTORY') {
    conversionHistory = [];
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'STORAGE_GET') {
    chrome.storage.local.get(message.keys || null, (result) => {
      sendResponse({ success: true, result });
    });
    return true;
  }

  if (message.type === 'STORAGE_SET') {
    chrome.storage.local.set(message.items || {}, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'STORAGE_REMOVE') {
    chrome.storage.local.remove(message.keys || [], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * スクリーンショットを取得してOCR処理
 */
async function handleScreenshotCapture(message, tabId) {
  try {
    // 1. タブ全体のスクリーンショットを取得
    const screenshotUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });

    // 2. OCR処理を実行（Offscreen Documentでクロッピングも実行）
    const ocrResult = await executeOCR(screenshotUrl, message.rect, message.viewport);

    // 3. 履歴に追加
    if (ocrResult.converted) {
      const tab = await chrome.tabs.get(tabId);
      addToHistory({
        timestamp: Date.now(),
        original: ocrResult.ocrText,
        converted: ocrResult.converted.converted,
        url: tab.url
      });

      // サイドパネルに通知
      notifySidePanel();
    }

    return {
      success: true,
      result: ocrResult.converted,
      ocrText: ocrResult.ocrText || ''
    };

  } catch (error) {
    console.error('Screenshot capture error:', error);
    throw error;
  }
}

/**
 * OCR処理を実行（Offscreen Documentで実行）
 */
async function executeOCR(screenshotUrl, rect, viewport) {
  // Offscreen Document APIを使用してTesseract.jsを実行
  // （Service WorkerではDOM APIが使えないため）

  try {
    // Offscreen documentが存在するか確認
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
      // Offscreen documentを作成
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_SCRAPING'],
        justification: 'OCR processing with Tesseract.js'
      });
    }

    // OCR処理をOffscreen documentに依頼（クロッピング情報も渡す）
    const result = await chrome.runtime.sendMessage({
      type: 'PERFORM_OCR',
      screenshotUrl: screenshotUrl,
      rect: rect,
      viewport: viewport
    });

    return result;

  } catch (error) {
    console.error('OCR execution error:', error);
    throw error;
  }
}

function addToHistory(item) {
  conversionHistory.unshift(item);
  // 最大100件まで保持
  if (conversionHistory.length > 100) {
    conversionHistory = conversionHistory.slice(0, 100);
  }
}

function notifySidePanel() {
  // サイドパネルが開いていれば更新を通知
  chrome.runtime.sendMessage({
    type: 'HISTORY_UPDATED'
  }).catch(() => {
    // サイドパネルが開いていない場合は無視
  });
}

/**
 * 既存タブにコンテンツスクリプトを再注入
 * 拡張リロード後の "Extension context invalidated" 対策
 */
async function reinjectContentScripts() {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;

    // 標準の制限ページは対象外
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('chrome-extension://')
    ) {
      continue;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['converter.js', 'content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });
    } catch {
      // 注入できないタブ（権限なし等）は無視
    }
  }
}
