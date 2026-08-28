/*
  本番と同じ配り方(静的ファイルのみ)で、実際のブラウザに言問いをさせる。
  ここで確かめるのは三つ。
   1. 問いに対して蔵書が並ぶか(F-01)
   2. 引用の一節が出るか(F-02)
   3. **外へ一度も通信していないか**(N-02)—— 全リクエストの行き先を記録して照合する
*/
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('out');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream',
  '.svg': 'image/svg+xml', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  // content-length を必ず返す。返さないと受信量を数えられず、
  // 「最初の一問で何 MB 落ちるか」(SPEC N-08)を実測できない。
  res.writeHead(200, {
    'content-type': MIME[path.extname(p)] ?? 'application/octet-stream',
    'content-length': fs.statSync(p).size,
  });
  fs.createReadStream(p).pipe(res);
});
// ポートは OS に選ばせる。固定すると、前の回で落ちた見張りが掴んだままのときに
// 起動できない(loop_001 で二度踏んだ)。
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
console.log(`検査用サーバ 127.0.0.1:${PORT}`);

const browser = await chromium.launch();
const page = await browser.newPage();
const external = [];
let bytes = 0;
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.host !== `127.0.0.1:${PORT}`) external.push(r.url());
});
page.on('response', async (r) => {
  const len = Number(r.headers()['content-length'] ?? 0);
  if (r.url().includes('/kotodoi/')) bytes += len;
});
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('  [ページ例外]', String(e).slice(0, 300)); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`  [${m.type()}]`, m.text().slice(0, 300)); });
page.on('requestfailed', (r) => console.log('  [失敗]', r.url().slice(0, 160), r.failure()?.errorText));
page.on('response', (r) => { if (r.status() >= 400) console.log('  [HTTP', r.status(), ']', r.url().slice(0, 160)); });

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
console.log('トップを開いた。ここまでで索引を取っていないこと(F-06):',
  bytes === 0 ? 'はい — 0 バイト' : `いいえ — ${bytes} バイト取っている`);

const t0 = Date.now();
await page.fill('.kotodoi__form input', '雨の日に読みたい');
await page.click('.kotodoi__form button');
await page.waitForSelector('.hit', { timeout: 600_000 });
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

const hits = await page.$$eval('.hit', (els) => els.slice(0, 5).map((e) => ({
  rank: e.querySelector('.hit__rank')?.textContent?.trim(),
  title: e.querySelector('.hit__title')?.textContent?.trim(),
  by: e.querySelector('.hit__by')?.textContent?.trim(),
  snip: e.querySelector('.hit__snip')?.textContent?.trim().slice(0, 40),
})));
console.log(`\n「雨の日に読みたい」— 最初の一問に ${elapsed} 秒 / 受け取った量 ${(bytes / 1048576).toFixed(1)} MB\n`);
for (const h of hits) console.log(`  ${h.rank}. ${h.title} — ${h.by}\n     ${h.snip}…`);

// 二問目は索引も模型も落とし直さないはず
const b1 = bytes;
await page.fill('.kotodoi__form input', '山を歩く');
await page.click('.kotodoi__form button');
await page.waitForFunction(() => document.querySelector('h3')?.textContent?.includes('山を歩く'), { timeout: 60_000 });
const second = await page.$$eval('.hit__title', (e) => e.slice(0, 3).map((x) => x.textContent));
console.log(`\n「山を歩く」— 追加で受け取った量 ${((bytes - b1) / 1048576).toFixed(2)} MB(一節のみのはず)`);
console.log('  ' + second.join(' / '));

// 狭い画面で横に溢れないか(N-07)
await page.setViewportSize({ width: 360, height: 720 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`\n360px 幅の横あふれ: ${overflow}px`);

console.log(`外部ホストへの通信: ${external.length} 件`, external.slice(0, 5));
console.log(`ページ内エラー: ${errors.length} 件`, errors.slice(0, 3));

await browser.close();
server.close();
const ok = external.length === 0 && errors.length === 0 && hits.length > 0 && overflow <= 0;
console.log(ok ? '\n通し検査 合格' : '\n通し検査 不合格');
process.exit(ok ? 0 : 1);
