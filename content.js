// Alt+ドラッグ検出とスクリーンショット取得

let isAltPressed = false;
let selectionStart = null;
let selectionBox = null;
let tooltip = null;

function suppressEvent(e) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === 'function') {
    e.stopImmediatePropagation();
  }
}

// Altキーの状態追跡
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') {
    isAltPressed = true;
    document.body.style.cursor = 'crosshair';
    document.documentElement.style.userSelect = 'none';
  }
}, true);

document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    isAltPressed = false;
    document.body.style.cursor = 'default';
    document.documentElement.style.userSelect = '';
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
  }
}, true);

// マウスダウン - 選択開始
document.addEventListener('mousedown', (e) => {
  if (!isAltPressed) return;

  suppressEvent(e);
  selectionStart = { x: e.pageX, y: e.pageY };

  // 選択範囲の視覚的フィードバック用div
  selectionBox = document.createElement('div');
  selectionBox.className = 'wareki-selection-box';
  selectionBox.style.left = e.pageX + 'px';
  selectionBox.style.top = e.pageY + 'px';
  document.body.appendChild(selectionBox);
}, true);

// マウスムーブ - 選択範囲の更新
document.addEventListener('mousemove', (e) => {
  if (!isAltPressed) return;
  suppressEvent(e);
  if (!selectionStart || !selectionBox) return;

  const width = e.pageX - selectionStart.x;
  const height = e.pageY - selectionStart.y;

  selectionBox.style.width = Math.abs(width) + 'px';
  selectionBox.style.height = Math.abs(height) + 'px';
  selectionBox.style.left = (width < 0 ? e.pageX : selectionStart.x) + 'px';
  selectionBox.style.top = (height < 0 ? e.pageY : selectionStart.y) + 'px';
}, true);

// マウスアップ - スクリーンショット取得
document.addEventListener('mouseup', async (e) => {
  if (!isAltPressed) return;
  suppressEvent(e);
  if (!selectionStart) return;

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
    const message = String(error && error.message ? error.message : error);
    if (message.includes('Extension context invalidated')) {
      showTooltip(rect, '拡張機能が更新されました。ページを再読み込みしてください。', false);
    } else {
      showTooltip(rect, 'エラー: ' + message, false);
    }
  }

  cleanupSelection();
}, true);

// ブラウザ標準の画像ドラッグも抑止（Alt押下時のみ）
document.addEventListener('dragstart', (e) => {
  if (!isAltPressed) return;
  suppressEvent(e);
}, true);

function cleanupSelection() {
  selectionStart = null;
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
}

function showTooltip(rect, text, isLoading, options = {}) {
  // 既存のツールチップを削除
  if (tooltip) {
    tooltip.remove();
  }

  tooltip = document.createElement('div');
  tooltip.className = 'wareki-tooltip' + (isLoading ? ' loading' : '');
  const textSpan = document.createElement('span');
  textSpan.className = 'wareki-tooltip-text';
  textSpan.textContent = text;
  tooltip.appendChild(textSpan);

  if (!isLoading) {
    if (options.copyText) {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'wareki-tooltip-copy';
      copyButton.setAttribute('aria-label', 'コピー');
      copyButton.textContent = '⎘';
      copyButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(options.copyText);
          copyButton.textContent = '✓';
          setTimeout(() => {
            copyButton.textContent = '⎘';
          }, 1200);
        } catch (err) {
          console.error('クリップボードコピー失敗:', err);
        }
      });
      tooltip.appendChild(copyButton);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'wareki-tooltip-close';
    closeButton.setAttribute('aria-label', '閉じる');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    });
    tooltip.appendChild(closeButton);
  }

  // 位置調整（選択範囲の上または下）
  const tooltipY = rect.top - 40 > 0 ? rect.top - 40 : rect.top + rect.height + 10;
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = tooltipY + 'px';

  document.body.appendChild(tooltip);
}

function handleOCRResult(result, rect, ocrText) {
  if (result && result.converted) {
    const displayText = `${result.original} → ${result.converted}`;
    showTooltip(rect, displayText, false, { copyText: result.converted });
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
