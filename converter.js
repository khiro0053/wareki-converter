// 和暦⇔西暦変換ロジック

const GENGO_MAP = {
  '令和': { start: 2019, abbr: 'R' },
  '平成': { start: 1989, abbr: 'H' },
  '昭和': { start: 1926, abbr: 'S' },
  '大正': { start: 1912, abbr: 'T' },
  '明治': { start: 1868, abbr: 'M' }
};

const KANJI_FULL_DATE = /(令和|平成|昭和|大正|明治)(\d{1,2}|元)年?(\d{1,2})月(\d{1,2})日?/;
const KANJI_YEAR_ONLY = /(令和|平成|昭和|大正|明治)(\d{1,2}|元)年?/;
const ABBR_FULL_DATE = /([RHSTM])(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{1,2})/;
const ABBR_YEAR_MONTH = /([RHSTM])(\d{1,2})[.\-/](\d{1,2})/;
const ABBR_YEAR_ONLY = /([RHSTM])(\d{1,2})/;

function normalizeWarekiText(text) {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[．。]/g, '.')
    .replace(/[‐‑‒–—―ー]/g, '-')
    .toUpperCase();
}

/**
 * 和暦テキストから西暦に変換
 * @param {string} text - OCRで認識されたテキスト
 * @returns {Object|null} - { original, converted, year, month, day, gengo }
 */
function convertWarekiToSeireki(text) {
  if (!text) return null;

  const normalizedText = normalizeWarekiText(text);

  // 漢字フル日付
  let match = normalizedText.match(KANJI_FULL_DATE);
  if (match) {
    return buildResult(
      match[1],
      match[2] === '元' ? 1 : parseInt(match[2], 10),
      parseInt(match[3], 10),
      parseInt(match[4], 10),
      match[0]
    );
  }

  // 漢字年のみ
  match = normalizedText.match(KANJI_YEAR_ONLY);
  if (match) {
    return buildResult(
      match[1],
      match[2] === '元' ? 1 : parseInt(match[2], 10),
      null,
      null,
      match[0]
    );
  }

  // 略記フル日付
  match = normalizedText.match(ABBR_FULL_DATE);
  if (match) {
    const gengoName = Object.keys(GENGO_MAP).find(
      key => GENGO_MAP[key].abbr === match[1]
    );
    return buildResult(
      gengoName,
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      parseInt(match[4], 10),
      match[0]
    );
  }

  // 略記年+月
  match = normalizedText.match(ABBR_YEAR_MONTH);
  if (match) {
    const gengoName = Object.keys(GENGO_MAP).find(
      key => GENGO_MAP[key].abbr === match[1]
    );
    return buildResult(
      gengoName,
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      null,
      match[0]
    );
  }

  // 略記年のみ
  match = normalizedText.match(ABBR_YEAR_ONLY);
  if (match) {
    const gengoName = Object.keys(GENGO_MAP).find(
      key => GENGO_MAP[key].abbr === match[1]
    );
    return buildResult(
      gengoName,
      parseInt(match[2], 10),
      null,
      null,
      match[0]
    );
  }

  return null;
}

function buildResult(gengoName, year, month, day, original) {
  if (!gengoName || !GENGO_MAP[gengoName]) {
    return null;
  }

  // 西暦年を計算
  const startYear = GENGO_MAP[gengoName].start;
  const seirekiYear = startYear + year - 1;

  // 元号の範囲チェック
  if (!isValidWareki(gengoName, year)) {
    return null;
  }
  if (!isValidMonthDay(month, day)) {
    return null;
  }

  // 結果を構築
  let converted;
  if (month && day) {
    converted = `${seirekiYear}年${month}月${day}日`;
  } else if (month) {
    converted = `${seirekiYear}年${month}月`;
  } else {
    converted = `${seirekiYear}年`;
  }

  return {
    original: original,
    converted: converted,
    year: seirekiYear,
    month: month,
    day: day,
    gengo: gengoName
  };
}

function isValidMonthDay(month, day) {
  if (month == null && day == null) return true;
  if (month == null || month < 1 || month > 12) return false;
  if (day == null) return true;
  return day >= 1 && day <= 31;
}

function isValidWareki(gengoName, year) {
  // 元号の有効期間チェック
  const validRanges = {
    '令和': [1, 100], // 現在進行中
    '平成': [1, 31],
    '昭和': [1, 64],
    '大正': [1, 15],
    '明治': [1, 45]
  };

  const range = validRanges[gengoName];
  if (!range) return false;

  return year >= range[0] && year <= range[1];
}

/**
 * 西暦から和暦に変換（逆変換）
 * @param {number} year - 西暦年
 * @returns {string|null}
 */
function convertSeirekiToWareki(year) {
  // 新しい元号から順にチェック
  const gengos = ['令和', '平成', '昭和', '大正', '明治'];

  for (const gengo of gengos) {
    const startYear = GENGO_MAP[gengo].start;
    if (year >= startYear) {
      const warekiYear = year - startYear + 1;
      if (isValidWareki(gengo, warekiYear)) {
        return warekiYear === 1 ? `${gengo}元年` : `${gengo}${warekiYear}年`;
      }
    }
  }

  return null;
}

// Node.jsとブラウザ両対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    convertWarekiToSeireki,
    convertSeirekiToWareki,
    GENGO_MAP
  };
}
