// プレースホルダーアイコン生成スクリプト
// Node.js標準ライブラリのみを使用（外部依存なし）

const fs = require('fs');
const path = require('path');

// SVGからPNGに変換するため、シンプルなdata URIを生成
function generateIconDataURL(size, text) {
  // SVGテンプレート
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#4285f4"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.floor(size * 0.6)}"
        font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">
    ${text}
  </text>
</svg>`.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Node.jsのみでSVGをPNGに変換するのは困難なため、
// 代わりに簡単な1x1の青いPNGを生成して、サイズを調整する
function generateSimplePNG(size) {
  // 最小限の青いPNG（1x1ピクセル、#4285f4）
  // 実際にはこれをサイズに合わせてスケーリングする必要があるが、
  // Node.js標準ライブラリだけでは難しいため、
  // 代わりにHTMLファイルを使ってブラウザで生成することを推奨

  // 単純な青い正方形のPNG（base64）
  const bluePNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width (1)
    0x00, 0x00, 0x00, 0x01, // height (1)
    0x08, 0x02, // bit depth (8), color type (2 = RGB)
    0x00, 0x00, 0x00,
    0x90, 0x77, 0x53, 0xde, // CRC
    0x00, 0x00, 0x00, 0x0c, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x63, 0x64, 0xa0, 0xa8, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0x18, 0x73, 0x87, 0x01, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82  // CRC
  ]);

  return bluePNG;
}

console.log('アイコン生成の代替方法を使用します...');
console.log('');
console.log('【注意】Node.js標準ライブラリのみではPNG画像の生成が困難です。');
console.log('以下のいずれかの方法でアイコンを生成してください：');
console.log('');
console.log('方法1: ブラウザのコンソールで生成（推奨）');
console.log('  1. Chrome DevToolsのコンソールを開く');
console.log('  2. 以下のコードを実行してダウンロード');
console.log('');
console.log(`
// コンソールにコピー&ペースト
[16, 48, 128].forEach(size => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'white';
  ctx.font = 'bold ' + Math.floor(size * 0.6) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暦', size / 2, size / 2);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'icon' + size + '.png';
    a.click();
  });
});
`);
console.log('');
console.log('方法2: オンラインツールを使用');
console.log('  https://www.favicon-generator.org/');
console.log('');
console.log('方法3: 一時的にシンプルなPNGファイルを作成（動作確認用）');

// 一時的なシンプルなPNGを作成（実際には正しい画像ではない）
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

sizes.forEach(size => {
  const filename = `icon${size}.png`;
  const filepath = path.join(iconsDir, filename);

  // 超シンプルな1x1の青いPNG（プレースホルダー）
  const simplePNG = generateSimplePNG(size);
  fs.writeFileSync(filepath, simplePNG);

  console.log(`✓ ${filename} を作成しました（プレースホルダー）`);
});

console.log('');
console.log('注意: 生成されたPNGファイルは1x1ピクセルのプレースホルダーです。');
console.log('実際の開発では上記の方法1または2を使用して適切なアイコンを作成してください。');
