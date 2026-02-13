// Tesseract.jsによるOCR処理

// Tesseract.jsの初期化
let tesseractReady = false;
let workerPromise = null;
const VISION_MONTHLY_LIMIT = 200;
const VISION_COUNT_PREFIX = 'vision_usage_';
const VISION_API_KEY_STORAGE_KEY = 'googleVisionApiKey';

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
    const variants = await buildImageVariants(imageDataUrl);
    const psms = pickPSMs(variants[0].width, variants[0].height);
    let bestText = '';
    let bestScore = -1;
    let bestConfidence = -1;
    let converted = null;

    for (const variant of variants) {
      for (const psm of psms) {
        await worker.setParameters({
          tessedit_pageseg_mode: String(psm),
          user_defined_dpi: '300'
        });

        const { data } = await worker.recognize(variant.url);
        const text = (data && data.text) ? data.text : '';
        const confidence = (data && typeof data.confidence === 'number') ? data.confidence : 0;

        console.log(`OCR Result [${variant.label}, PSM=${psm}]`, text);

        const candidate = convertWarekiToSeireki(text);
        if (candidate) {
          converted = candidate;
          bestText = text;
          break;
        }

        const score = scoreTextForWareki(text);
        if (score > bestScore || (score === bestScore && confidence > bestConfidence)) {
          bestScore = score;
          bestConfidence = confidence;
          bestText = text;
        }
      }
      if (converted) break;
    }

    // ローカルOCRで未検出の場合のみ Google Vision へフォールバック
    if (!converted) {
      const visionText = await runGoogleVisionOCRWithLimit(imageDataUrl);
      if (visionText) {
        console.log('Google Vision OCR Result:', visionText);
        const visionConverted = convertWarekiToSeireki(visionText);
        if (visionConverted) {
          converted = visionConverted;
          bestText = visionText;
        } else if (!bestText) {
          bestText = visionText;
        }
      }
    }

    return {
      ocrText: bestText,
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
 * 和暦候補のスコアを算出（未検出時の最善候補選択用）
 */
function scoreTextForWareki(text) {
  if (!text) return 0;
  const normalized = text.normalize('NFKC');
  let score = 0;
  if (/(令和|平成|昭和|大正|明治)/.test(normalized)) score += 6;
  if (/[RHSMT]/i.test(normalized)) score += 2;
  if (/\d{1,2}/.test(normalized)) score += 1;
  if (/[年月日]/.test(normalized)) score += 2;
  return score;
}

function pickPSMs(width, height) {
  // 縦長領域は縦書き想定の PSM 5 を優先
  const horizontalRatio = width > 0 && height > 0 ? width / height : 1;
  const verticalRatio = width > 0 && height > 0 ? height / width : 1;
  if (verticalRatio > 2.2) return [5, 6, 11, 7];
  // 1行に近い横長領域なら PSM 7 を優先
  if (horizontalRatio > 4) return [7, 6, 11];
  return [6, 7, 11];
}

/**
 * 画像の前処理バリエーションを作成
 * @param {string} imageDataUrl
 * @returns {Promise<Array<{label: string, url: string, width: number, height: number}>>}
 */
async function buildImageVariants(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const variants = [];
      variants.push({
        label: 'original',
        url: imageDataUrl,
        width: img.width,
        height: img.height
      });

      const scaled = makeProcessedImage(img, { scale: 2, mode: 'gray' });
      variants.push({
        label: 'gray-x2',
        url: scaled,
        width: img.width * 2,
        height: img.height * 2
      });

      const binarySoft = makeProcessedImage(img, { scale: 2, mode: 'binary', threshold: 160 });
      variants.push({
        label: 'binary160-x2',
        url: binarySoft,
        width: img.width * 2,
        height: img.height * 2
      });

      const binaryHard = makeProcessedImage(img, { scale: 2, mode: 'binary', threshold: 190 });
      variants.push({
        label: 'binary190-x2',
        url: binaryHard,
        width: img.width * 2,
        height: img.height * 2
      });

      resolve(variants);
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

function makeProcessedImage(img, options) {
  const scale = options.scale || 1;
  const mode = options.mode || 'gray';
  const threshold = options.threshold || 160;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = Math.max(1, Math.floor(img.width * scale));
  canvas.height = Math.max(1, Math.floor(img.height * scale));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const value = mode === 'binary' ? (gray > threshold ? 255 : 0) : gray;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function storageGet(keys) {
  if (chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'STORAGE_GET', keys })
      .then((response) => resolve((response && response.result) || {}))
      .catch(() => resolve({}));
  });
}

function storageSet(items) {
  if (chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'STORAGE_SET', items })
      .then(() => resolve())
      .catch(() => resolve());
  });
}

async function reserveVisionUsage() {
  const ym = getCurrentYearMonth();
  const usageKey = `${VISION_COUNT_PREFIX}${ym}`;
  const data = await storageGet([usageKey]);
  const used = Number(data[usageKey] || 0);
  if (used >= VISION_MONTHLY_LIMIT) {
    return { allowed: false, used };
  }
  const next = used + 1;
  await storageSet({ [usageKey]: next });
  return { allowed: true, used: next };
}

async function runGoogleVisionOCRWithLimit(imageDataUrl) {
  try {
    const settings = await storageGet([VISION_API_KEY_STORAGE_KEY]);
    const apiKey = settings[VISION_API_KEY_STORAGE_KEY];
    if (!apiKey) {
      console.log('Google Vision skipped: API key not configured.');
      return '';
    }

    const usage = await reserveVisionUsage();
    if (!usage.allowed) {
      console.warn(`Google Vision skipped: monthly limit reached (${VISION_MONTHLY_LIMIT}).`);
      return '';
    }

    const base64Content = imageDataUrl.split(',')[1];
    if (!base64Content) return '';

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Content },
              features: [{ type: 'TEXT_DETECTION' }],
              imageContext: { languageHints: ['ja'] }
            }
          ]
        })
      }
    );

    if (!response.ok) {
      console.warn('Google Vision request failed:', response.status, response.statusText);
      return '';
    }

    const data = await response.json();
    const result = data.responses && data.responses[0];
    if (!result) return '';

    if (result.fullTextAnnotation && result.fullTextAnnotation.text) {
      return result.fullTextAnnotation.text;
    }
    if (result.textAnnotations && result.textAnnotations[0] && result.textAnnotations[0].description) {
      return result.textAnnotations[0].description;
    }

    return '';
  } catch (error) {
    console.warn('Google Vision OCR error:', error);
    return '';
  }
}
