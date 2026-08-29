/*
  本番 URL に対して、実ブラウザで実際に問う。
  ローカルの out/ で通っても、配信層(Content-Type・リダイレクト・圧縮)で壊れうる。
  ここが最後の検品である。
*/
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://kototoi-do.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage();

const foreign = [];
let bytes = 0;
page.on('request', (r) => {
  const h = new URL(r.url()).host;
  if (h !== new URL(BASE).host) foreign.push(r.url());
});
page.on('response', (r) => { if (r.url().includes('/kotodoi/')) bytes += Number(r.headers()['content-length'] ?? 0); });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
console.log(`トップを開いた。索引の取得 ${bytes} バイト(0 であること)`);

const t0 = Date.now();
await page.fill('.kotodoi__form input', '山を歩く');
await page.click('.kotodoi__form button');
await page.waitForSelector('.hit', { timeout: 300_000 });
console.log(`\n「山を歩く」— ${((Date.now() - t0) / 1000).toFixed(1)} 秒 / ${(bytes / 1048576).toFixed(1)} MB`);
for (const h of await page.$$eval('.hit', (e) => e.slice(0, 5).map((x) => ({
  t: x.querySelector('.hit__title')?.textContent, b: x.querySelector('.hit__by')?.textContent,
  s: x.querySelector('.hit__snip')?.textContent?.slice(0, 36),
})))) console.log(`  ${h.t} — ${h.b}\n    ${h.s}…`);

await page.setViewportSize({ width: 360, height: 720 });
const of360 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

console.log(`\n360px の横あふれ ${of360}px / 外部ホストへの通信 ${foreign.length} 件 / エラー ${errors.length} 件`);
if (foreign.length) console.log('  ', foreign.slice(0, 5));
if (errors.length) console.log('  ', errors.slice(0, 3));
await browser.close();
const ok = foreign.length === 0 && errors.length === 0 && of360 <= 0;
console.log(ok ? '\n本番の通し検査 合格' : '\n本番の通し検査 不合格');
process.exit(ok ? 0 : 1);
