#!/usr/bin/env node
/*
  R's Little Film まとめて加工スクリプト（Claude Code などから使う用）

  アプリ本体（index.html）を裏で開いて、同じ加工をフォルダの写真ぜんぶにかけて書き出します。
  仕上がりはアプリで作ったものとまったく同じになります。

  使い方:
    node tools/littlefilm-batch.js --in 写真のフォルダ --out 書き出し先 [設定]

  設定（どれか / 組み合わせOK）:
    --favorites littlefilm-favorites.json --favorite "パリの朝"   アプリから書き出したお気に入りを使う
    --recipe recipe.json                                           設定をまとめたJSONファイル
    --preset AN --strength 80                                       プリセットと強さ（0〜100）
    --size 4:5                                                      none / 4:5 / 3:4 / 5:4 / 4:3 / 1:1 / 9:16
    --style fill                                                    simple（背景＋余白）/ fill（写真いっぱい）/ postcard（タイトル入り）
    --title love --place Copenhagen                                 タイトル（postcards / love）と地名
    --grain 30 --leak 20 --halation 20 --dust 10 --frame 30 --border 0   フィルム効果（0〜100）
    --stamp                                                         日付スタンプ

  例:
    node tools/littlefilm-batch.js --in ~/Copenhagen --out ~/Copenhagen-edited --preset AN --size 4:5 --title love --place Copenhagen
*/
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright が必要です: npm i playwright && npx playwright install chromium'); process.exit(1); }

// ---------- 引数
const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2), next = args[i + 1];
  if (next === undefined || next.startsWith('--')) opt[key] = true; else { opt[key] = next; i++; }
}
if (!opt.in || !opt.out) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
  process.exit(opt.help ? 0 : 1);
}

// ---------- 設定（recipe）を組み立てる
const recipe = opt.recipe ? JSON.parse(fs.readFileSync(opt.recipe, 'utf8')) : {};
if (opt.favorites) {
  const data = JSON.parse(fs.readFileSync(opt.favorites, 'utf8'));
  const list = data.favorites || data;
  const f = opt.favorite ? list.find(x => x.name === opt.favorite) : list[0];
  if (!f) { console.error(`お気に入り「${opt.favorite}」が見つかりません。入っているのは: ${list.map(x => x.name).join(' / ')}`); process.exit(1); }
  recipe.favoriteData = f;
}
if (opt.preset) recipe.preset = opt.preset;
if (opt.strength) recipe.strength = +opt.strength / 100;
if (opt.size) recipe.size = opt.size;
if (opt.style) recipe.style = opt.style;
if (opt.title || opt.place) recipe.title = { ...(recipe.title || {}), template: opt.title || 'postcards', ...(opt.place ? { place: opt.place } : {}) };
const film = {};
for (const k of ['grain', 'leak', 'halation', 'dust', 'frame', 'border']) if (opt[k] != null) film[k] = +opt[k] / 100;
if (opt.stamp) film.stamp = true;
if (Object.keys(film).length) recipe.film = { ...(recipe.film || {}), ...film };

// ---------- 写真を集める
const IMG = /\.(jpe?g|png|webp|heic|heif)$/i;
const inputs = fs.readdirSync(opt.in).filter(f => IMG.test(f)).sort().map(f => path.join(opt.in, f));
if (!inputs.length) { console.error('写真が見つかりませんでした: ' + opt.in); process.exit(1); }
fs.mkdirSync(opt.out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.LittleFilm);

  let applied = false, ok = 0;
  for (const [i, file] of inputs.entries()) {
    await page.setInputFiles('#file', file);
    await page.waitForFunction(() => state.src && state.type === 'image', null, { timeout: 30000 });
    if (!applied) { await page.evaluate(r => LittleFilm.applyRecipe(r), recipe); applied = true; }
    else await page.evaluate(() => requestRender());
    await page.waitForTimeout(300);
    const b64 = await page.evaluate(() => LittleFilm.exportJpeg());
    const outName = path.basename(file).replace(/\.[^.]+$/, '') + '_littlefilm.jpg';
    fs.writeFileSync(path.join(opt.out, outName), Buffer.from(b64, 'base64'));
    ok++;
    console.log(`[${i + 1}/${inputs.length}] ${outName}`);
  }
  await browser.close();
  if (errors.length) console.warn('注意:', errors.join(' / '));
  console.log(`できたよ：${ok}枚 → ${opt.out}`);
})().catch(e => { console.error(e.message); process.exit(1); });
