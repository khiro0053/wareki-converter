// Tesseract.jsによるOCR処理

// Tesseract.jsの初期化
let tesseractReady = false;
let workerPromise = null;

function isBenignTesseractWarning(err) {
  return String(err).includes('Parameter not found');
}

async function initTesseract() {
  if (tesseractReady) return;

  try {
    // Tesseract.jsのロード確認
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js not loaded');
    }
    tesseractReady = true;
    console.log('Tesseract.js initialized');
  } catch (error) {
    console.error('Failed to initialize Tesseract:', error);
    throw error;
  }
}

async function getOCRWorker() {
  if (workerPromise) return workerPromise;

  workerPromise = Tesseract.createWorker('jpn+eng', 1, {
    workerPath: chrome.runtime.getURL('lib/worker-wrapper.js'),
    corePath: chrome.runtime.getURL('lib'),
    // 学習データは projectnaptha から取得（gzip有効）
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    workerBlobURL: false,
    logger: () => {},
    errorHandler: err => {
      if (isBenignTesseractWarning(err)) return;
      console.error(err);
    }
  });

  return workerPromise;
}

/**
 * 画像からOCRで和暦を抽出
 * @param {string} imageDataUrl - base64エンコードされた画像
 * @returns {Promise<Object>} - { ocrText, converted }
 */
async function performOCR(imageDataUrl) {
  await initTesseract();

  try {
    const worker = await getOCRWorker();

    // 画像前処理
    const processedImage = await preprocessImage(imageDataUrl);
    const sources = [processedImage, imageDataUrl];
    let lastText = '';
    let converted = null;

    for (const source of sources) {
      const { data: { text } } = await worker.recognize(source);
      lastText = text || '';
      console.log('OCR Result:', lastText);
      converted = convertWarekiToSeireki(lastText);
      if (converted) break;
    }

    return {
      ocrText: lastText,
      converted: converted,
      success: true
    };

  } catch (error) {
    console.error('OCR Error:', error);
    return {
      ocrText: '',
      converted: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * 画像の前処理（精度向上のため）
 * @param {string} imageDataUrl
 * @returns {Promise<string>} - 処理後の画像
 */
async function preprocessImage(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 画像を2倍に拡大（OCR精度向上）
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;

      // アンチエイリアスなしで描画
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // グレースケール化とコントラスト強調
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // グレースケール
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

        // 二値化（閾値128）
        const binary = gray > 128 ? 255 : 0;

        data[i] = data[i + 1] = data[i + 2] = binary;
      }

      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}
