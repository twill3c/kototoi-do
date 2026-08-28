// 最初の一問で閲覧者が受け取る量を実測し、画面に出せる形で残す(SPEC N-08)。
// 見積もりを書かない —— 配布物そのもののバイト数を数える。
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/kotodoi';
const sum = (files) => files.reduce((s, f) => s + fs.statSync(f).size, 0);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

const index = sum(['vec.i8', 'own.u16', 'pos.u32', 'meta.json'].map((f) => path.join(DIR, f)));
const model = sum(walk(path.join(DIR, 'model')));
// 実際に使う実行系だけを数える。jsep 版は寄せ替えが効かなくなったときの控えで、
// 通常は取りに行かない(next.config.ts で非 jsep の束に寄せてある)。
const runtime = fs.statSync(path.join(DIR, 'ort/ort-wasm-simd-threaded.wasm')).size;
const total = index + model + runtime;

const mb = (n) => Math.round((n / 1048576) * 10) / 10;
const payload = { index: mb(index), model: mb(model), runtime: mb(runtime), total: mb(total), bytes: total };
fs.writeFileSync('src/data/payload.json', JSON.stringify(payload, null, 1));
console.log(`索引 ${payload.index} MB / 読み取り機 ${payload.model} MB / 実行系 ${payload.runtime} MB → 計 ${payload.total} MB`);
if (payload.total > 60) { console.error('SPEC N-08(60 MB 以下)を超えている'); process.exit(1); }
