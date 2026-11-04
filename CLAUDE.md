# R's Little Film — Claude 向けメモ

写真・動画の色味編集Webアプリ（`index.html` 1ファイル）。GitHub Pages: https://r-studio7.github.io/little-film/
ユーザーは Rinaさん。返事は日本語・少しくだけた話し方・要点先・具体例つき。

## 写真をまとめて加工してほしいと頼まれたら
`tools/littlefilm-batch.js` を使う。アプリ本体を裏で動かすので、仕上がりはアプリと同じ。
写真を1枚ずつ見る必要はない（トークン節約）。確認は最後に数枚だけ縮小して見れば十分。

```bash
node tools/littlefilm-batch.js --in <写真フォルダ> --out <書き出し先> [設定]
```

設定の例:
- お気に入りを使う: `--favorites littlefilm-favorites.json --favorite "パリの朝"`
  （JSONはアプリの★タブ「お気に入りをファイルに書き出す」で作れる）
- 指定する: `--preset AN --strength 80 --size 4:5 --style fill`
- タイトル: `--title love --place Copenhagen`（postcards / love）
- フィルム: `--grain 30 --leak 20 --halation 20 --dust 10 --frame 30 --border 0 --stamp`

サイズ: none / 4:5 / 3:4 / 5:4 / 4:3 / 1:1 / 9:16。スタイル: simple / fill / postcard。
プリセットID: OR, AN, F1, W1, C1, B1, P1, R1, G1, T1, V1, D1, M1, M2。
Playwright が必要（この環境には入っている）。動画は対象外（アプリで1本ずつ）。

## 開発メモ
- バージョン表示 `APP_VERSION` を変更ごとに上げる（Safariのキャッシュ確認用）。
- 外部から操作する入口: `window.LittleFilm.applyRecipe({...})` / `LittleFilm.exportJpeg()`。
