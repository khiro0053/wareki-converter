// 和暦⇔西暦変換ロジック

const GENGO_MAP = {
  '令和': { start: 2019, abbr: 'R' },
  '平成': { start: 1989, abbr: 'H' },
  '昭和': { start: 1926, abbr: 'S' },
  '大正': { start: 1912, abbr: 'T' },
  '明治': { start: 1868, abbr: 'M' }
};

// 和暦パターンの正規表現
const WAREKI_PATTERNS = [
  // 漢字表記: 令和5年12月31日
  /([令平昭大明][和成正治])(\d{1,2}|元)年(\d{1,2})月(\d{1,2})日/,

  // 漢字表記（年のみ）: 令和5年
  /([令平昭大明][和成正治])(\d{1,2}|元)年/,

  // 略記表記: R5.12.31
  /([RHSTM])(\d{1,2})\.(\d{1,2})\.(\d{1,2})/,

  // 略記表記（年のみ）: R5
  /([RHSTM])(\d{1,2})/
];

/**
 * 和暦テキストから西暦に変換
 * @param {string} text - OCRで認識されたテキスト
 * @returns {Object|null} - { original, converted, year, month, day, gengo }
 */
function convertWarekiToSeireki(text) {
  if (!text) return null;

  // 各パターンを試行
  for (const pattern of WAREKI_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    const result = parseWarekiMatch(match);
    if (result) {
      return result;
    }
  }

  return null;
}

function parseWarekiMatch(match) {
  let gengoName = null;
  let year = null;
  let month = null;
  let day = null;

  // パターン1,2: 漢字表記
  if (match[1] && match[1].length === 2) {
    gengoName = match[1];
    year = match[2] === '元' ? 1 : parseInt(match[2], 10);
    month = match[3] ? parseInt(match[3], 10) : null;
    day = match[4] ? parseInt(match[4], 10) : null;
  }
  // パターン3,4: 略記表記
  else if (match[1] && match[1].length === 1) {
    const abbr = match[1];
    gengoName = Object.keys(GENGO_MAP).find(
      key => GENGO_MAP[key].abbr === abbr
    );
    year = parseInt(match[2], 10);
    month = match[3] ? parseInt(match[3], 10) : null;
    day = match[4] ? parseInt(match[4], 10) : null;
  }

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
    original: match[0],
    converted: converted,
    year: seirekiYear,
    month: month,
    day: day,
    gengo: gengoName
  };
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
