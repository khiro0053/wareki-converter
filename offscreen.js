// Offscreen Documentでのメッセージ処理

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PERFORM_OCR') {
    // クロッピングしてからOCR実行
    cropAndPerformOCR(message.screenshotUrl, message.rect, message.viewport)
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

/**
 * 画像をクロッピングしてOCR実行
 */
async function cropAndPerformOCR(screenshotUrl, rect, viewport) {
  try {
    // 1. 画像をクロッピング
    const croppedImageUrl = await cropImage(screenshotUrl, rect, viewport);

    // 2. OCR実行
    const result = await performOCR(croppedImageUrl);

    return result;
  } catch (error) {
    console.error('Crop and OCR error:', error);
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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // スクロール位置とデバイスピクセル比を考慮
      const sourceX = (rect.left - viewport.scrollX) * viewport.devicePixelRatio;
      const sourceY = (rect.top - viewport.scrollY) * viewport.devicePixelRatio;
      const sourceWidth = rect.width * viewport.devicePixelRatio;
      const sourceHeight = rect.height * viewport.devicePixelRatio;

      // クロッピング後のサイズ
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}
