// Background Service Worker (Manifest V3)

// サイドパネルの履歴データ
let conversionHistory = [];

// インストール時の初期化
chrome.runtime.onInstalled.addListener(() => {
  console.log('和暦⇔西暦変換拡張機能がインストールされました');
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

    // 2. 選択範囲をクロッピング
    const croppedImage = await cropImage(
      screenshotUrl,
      message.rect,
      message.viewport
    );

    // 3. OCR処理を実行（Offscreen Documentを使用）
    const ocrResult = await executeOCR(croppedImage);

    // 4. 履歴に追加
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
      result: ocrResult.converted
    };

  } catch (error) {
    console.error('Screenshot capture error:', error);
    throw error;
  }
}

/**
 * 画像をクロッピング
 */
async function cropImage(imageDataUrl, rect, viewport) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = new OffscreenCanvas(
        rect.width * viewport.devicePixelRatio,
        rect.height * viewport.devicePixelRatio
      );
      const ctx = canvas.getContext('2d');

      // スクロール位置とデバイスピクセル比を考慮
      const sourceX = (rect.left - viewport.scrollX) * viewport.devicePixelRatio;
      const sourceY = (rect.top - viewport.scrollY) * viewport.devicePixelRatio;
      const sourceWidth = rect.width * viewport.devicePixelRatio;
      const sourceHeight = rect.height * viewport.devicePixelRatio;

      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      );

      canvas.convertToBlob().then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

/**
 * OCR処理を実行（Offscreen Documentで実行）
 */
async function executeOCR(imageDataUrl) {
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

    // OCR処理をOffscreen documentに依頼
    const result = await chrome.runtime.sendMessage({
      type: 'PERFORM_OCR',
      imageDataUrl: imageDataUrl
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
