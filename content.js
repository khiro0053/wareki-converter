// Alt+ドラッグ検出とスクリーンショット取得

let isAltPressed = false;
let selectionStart = null;
let selectionBox = null;
let tooltip = null;

// Altキーの状態追跡
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') {
    isAltPressed = true;
    document.body.style.cursor = 'crosshair';
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    isAltPressed = false;
    document.body.style.cursor = 'default';
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
  }
});

// マウスダウン - 選択開始
document.addEventListener('mousedown', (e) => {
  if (!isAltPressed) return;

  e.preventDefault();
  selectionStart = { x: e.pageX, y: e.pageY };

  // 選択範囲の視覚的フィードバック用div
  selectionBox = document.createElement('div');
  selectionBox.className = 'wareki-selection-box';
  selectionBox.style.left = e.pageX + 'px';
  selectionBox.style.top = e.pageY + 'px';
  document.body.appendChild(selectionBox);
});

// マウスムーブ - 選択範囲の更新
document.addEventListener('mousemove', (e) => {
  if (!isAltPressed || !selectionStart || !selectionBox) return;

  const width = e.pageX - selectionStart.x;
  const height = e.pageY - selectionStart.y;

  selectionBox.style.width = Math.abs(width) + 'px';
  selectionBox.style.height = Math.abs(height) + 'px';
  selectionBox.style.left = (width < 0 ? e.pageX : selectionStart.x) + 'px';
  selectionBox.style.top = (height < 0 ? e.pageY : selectionStart.y) + 'px';
});

// マウスアップ - スクリーンショット取得
document.addEventListener('mouseup', async (e) => {
  if (!isAltPressed || !selectionStart) return;

  const endX = e.pageX;
  const endY = e.pageY;

  // 選択範囲の座標を計算
  const rect = {
    left: Math.min(selectionStart.x, endX),
    top: Math.min(selectionStart.y, endY),
    width: Math.abs(endX - selectionStart.x),
    height: Math.abs(endY - selectionStart.y)
  };

  // 最小サイズチェック
  if (rect.width < 20 || rect.height < 10) {
    cleanupSelection();
    return;
  }

  // ローディング表示
  showTooltip(rect, 'OCR処理中...', true);

  try {
    // スクリーンショットをbackgroundに依頼
    const response = await chrome.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT',
      rect: rect,
      viewport: {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio
      }
    });

    if (response.success) {
      // OCR処理結果を表示
      handleOCRResult(response.result, rect, response.ocrText || '');
    } else {
      showTooltip(rect, 'エラー: ' + response.error, false);
    }
  } catch (error) {
    showTooltip(rect, 'エラー: ' + error.message, false);
  }

  cleanupSelection();
});

function cleanupSelection() {
  selectionStart = null;
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
}

function showTooltip(rect, text, isLoading) {
  // 既存のツールチップを削除
  if (tooltip) {
    tooltip.remove();
  }

  tooltip = document.createElement('div');
  tooltip.className = 'wareki-tooltip' + (isLoading ? ' loading' : '');
  tooltip.textContent = text;

  // 位置調整（選択範囲の上または下）
  const tooltipY = rect.top - 40 > 0 ? rect.top - 40 : rect.top + rect.height + 10;
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = tooltipY + 'px';

  document.body.appendChild(tooltip);

  if (!isLoading) {
    // 5秒後に自動削除
    setTimeout(() => {
      if (tooltip) tooltip.remove();
    }, 5000);
  }
}

function handleOCRResult(result, rect, ocrText) {
  if (result && result.converted) {
    const displayText = `${result.original} → ${result.converted}`;
    showTooltip(rect, displayText, false);

    // クリップボードにコピー
    navigator.clipboard.writeText(result.converted).catch(err => {
      console.error('クリップボードコピー失敗:', err);
    });
  } else {
    const preview = (ocrText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const suffix = preview ? ` (OCR: ${preview})` : '';
    showTooltip(rect, `和暦が見つかりませんでした${suffix}`, false);
  }
}

// backgroundからのメッセージ受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OCR_COMPLETE') {
    // サイドパネルが開いた時などの追加処理
    console.log('OCR完了:', message.result);
  }
});
