// 本文チャンクの埋め込みをローカルで事前計算する(SPEC N-04)。
// Vercel のビルド中には決して走らせない。成果物をリポジトリに置いて配る。
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import { loadWorks, readBody, chunkBody } from './lib-corpus.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i < 0 ? d : process.argv[i + 1];
};
const LIMIT = Number(arg('limit', Infinity));
const STRIDE = Number(arg('stride', 1));
const K = Number(arg('chunks', 8));
const OUT = arg('out', 'data/embed');
const MODEL = 'Xenova/multilingual-e5-small';
const BATCH = 64;

fs.mkdirSync(OUT, { recursive: true });

const works = loadWorks({ limit: LIMIT, stride: STRIDE });
console.log(`作品 ${works.length} 件 / 1 作あたり最大 ${K} チャンク`);

const meta = [];
const chunks = [];
for (let wi = 0; wi < works.length; wi++) {
  const w = works[wi];
  let body;
  try { body = readBody(w.id); } catch { continue; }
  const cs = chunkBody(body, K);
  if (cs.length === 0) continue;
  meta.push({ id: w.id, title: w.title, author: w.author, ndc: w.ndc ?? '', chars: w.chars ?? body.length });
  const mi = meta.length - 1;
  for (const c of cs) chunks.push({ w: mi, pos: c.pos, text: c.text });
}
console.log(`索引対象 ${meta.length} 作 / チャンク ${chunks.length} 件`);

const ex = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
const D = 384;
// ベクトルは溜めずに書き流す。全件(5,000 作 × 8 本)を配列で抱えると
// 実行環境の常駐が数 GB に膨らむため。
const sink = fs.createWriteStream(path.join(OUT, 'vec_f32.bin'));
const write = (buf) => new Promise((res, rej) => { sink.write(buf) ? res() : sink.once('drain', res); sink.once('error', rej); });
const t0 = Date.now();
for (let i = 0; i < chunks.length; i += BATCH) {
  const slice = chunks.slice(i, i + BATCH);
  // e5 は接頭辞を要求する。索引側は passage:、問い合わせ側は query:
  const out = await ex(slice.map((c) => 'passage: ' + c.text), { pooling: 'mean', normalize: true });
  await write(Buffer.from(Float32Array.from(out.data).buffer));
  if ((i / BATCH) % 10 === 0 || i + BATCH >= chunks.length) {
    const done = Math.min(i + BATCH, chunks.length);
    const el = (Date.now() - t0) / 1000;
    const eta = el / done * (chunks.length - done);
    console.log(`  ${done}/${chunks.length}  経過 ${el.toFixed(0)}s  残り ${eta.toFixed(0)}s`);
  }
}
await new Promise((res) => sink.end(res));
fs.writeFileSync(path.join(OUT, 'chunks.json'), JSON.stringify({ model: MODEL, dims: D, K, meta, chunks }));
const bytes = fs.statSync(path.join(OUT, 'vec_f32.bin')).size;
if (bytes !== chunks.length * D * 4) throw new Error(`書き出し量が合わない: ${bytes} != ${chunks.length * D * 4}`);
console.log(`書き出し → ${OUT}  (${(bytes / 1e6).toFixed(1)} MB float32)`);
