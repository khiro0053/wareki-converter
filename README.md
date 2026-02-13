# 和暦⇔西暦変換 Chrome拡張機能

画像から和暦を読み取り、西暦に自動変換するChrome拡張機能です。

## 機能

- 📸 画像からOCRで和暦を認識（Tesseract.js使用）
- 🔄 令和・平成・昭和などの和暦を西暦に自動変換
- 💡 ツールチップ・サイドパネル・クリップボードで結果表示
- 🧭 ローカルOCR失敗時のみ、任意でGoogle Vision APIへフォールバック

## インストール方法

1. このリポジトリをクローン
2. Chrome拡張機能ページ（chrome://extensions/）を開く
3. デベロッパーモードをONにする
4. 「パッケージ化されていない拡張機能を読み込む」から本フォルダを選択

## 使い方

1. Webページ上で**Altキーを押しながら**和暦部分をドラッグ選択
2. 自動的にOCR処理が実行され、西暦に変換されます
3. 結果はツールチップ、サイドパネル、クリップボードに表示されます
4. Google Vision APIを使う場合は、オプション画面で**各ユーザーが自身のAPIキー**を設定してください

## 対応する和暦形式

- 漢字表記: 令和5年12月31日
- 略記表記: R5.12.31
- 対応元号: 令和、平成、昭和、大正、明治

## 技術スタック

- Manifest V3
- Tesseract.js (OCR)
- Google Cloud Vision API（任意）
- Vanilla JavaScript

## 権限と用途

- `activeTab`: 現在タブの画面範囲を選択してOCRするため
- `scripting`: 既存タブへのコンテンツスクリプト再注入のため
- `offscreen`: OCR処理用Offscreen Document実行のため
- `storage`: APIキー設定・Vision利用回数保存のため
- `sidePanel`: 変換履歴表示のため
- `clipboardWrite`: 変換結果コピーのため
- `host_permissions <all_urls>`: 任意サイトで範囲選択OCRを有効化するため

## プライバシーとAPIキー

- 通常OCRはローカルで実行されます
- ローカルOCRで未検出の場合のみ、Google Vision APIを使用できます
- Vision APIキーはユーザーが各自設定し、開発者キーは同梱しません
- APIキーは拡張ストレージ（ローカル）に保存されます
- Vision利用回数は月次上限（既定200回）で制御されます

## ライセンス

MIT
