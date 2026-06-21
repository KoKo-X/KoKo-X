# CSS編集ガイド

同じ見た目を複数のCSSで上書きしないことを基本ルールとします。

## どこを編集するか

- トップページの見出し・トップ固有表示：`/style.css`
- 千葉県ページ・54市町村ページの見出し：`/chiba/style.css`
- 3カテゴリページの見出し：`/category.css`
- 掲載希望・問い合わせページの見出し：`/static.css`
- キーワード検索ページの見出し：`/search/style.css`
- 全ページ共通の色・ヘッダー・ボタン・カード：`/assets/css/common.css`
- 本番の千葉県マップ：`/chiba/map.css`
- 店舗専用LP：各店舗フォルダ内の専用CSS

## 見出しサイズのルール

各HTMLが直接読み込むCSSは原則1枚です。ページ側のCSSから、変更頻度の低い共通CSSを読み込みます。

`assets/css/common.css`では、H1・H2・H3の余白と行間だけを扱います。
フォントサイズは各ページ種別のCSSだけに記述します。

## テストページ

`/map-test/`は独立した検証環境です。

- `/map-test/index.html`
- `/map-test/style.css`
- `/map-test/script.js`
- `/map-test/data/`
- `/map-test/maps/`

本番サイトのCSS、JavaScript、SVG、JSONは参照しません。
テスト内容を本番へ反映する場合は、採用する変更だけを本番ファイルへ移植します。
