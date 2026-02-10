// Offscreen Documentでのメッセージ処理

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PERFORM_OCR') {
    performOCR(message.imageDataUrl)
      .then(sendResponse)
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true; // 非同期レスポンス
  }
});
