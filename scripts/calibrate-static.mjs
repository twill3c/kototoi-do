// 静的トークン表方式を、変換器方式と同じ計器(lib-oracle)で測る。
import fs from 'node:fs';
import path from 'node:path';
import { AutoTokenizer } from '@huggingface/transformers';
import { buildQueries, gate01, shuffled } from './lib-oracle.mjs';

const CALIB = process.argv[2] ?? 'data/calib';
const STATIC = process.argv[3] ?? 'data/static';

const { meta, chunks } = JSON.parse(fs.readFileSync(path.join(CALIB, 'chunks.json'), 'utf8'));
const { dims: D, ids } = JSON.parse(fs.readFileSync(path.join(STATIC, 'ids.json'), 'utf8'));
const tb = fs.readFileSync(path.join(STATIC, 'table_f32.bin'));
const TABLE = new Float32Array(tb.buffer, tb.byteOffset, tb.byteLength / 4);
const row = new Map(ids.map((id, i) => [id, i]));
console.log(`静的表 ${ids.length} トークン / ${D} 次元 ・ 索引 ${meta.length} 作 / ${chunks.length} チャンク`);

const tok = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-small');
const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; for (let k = 0; k < v.length; k++) v[k] /= s; return v; };

/** 文のベクトル = 含まれるトークンのベクトルの平均。文脈は捨てる。 */
function encode(text) {
  const out = new Float32Array(D);
  let n = 0;
  for (const id of tok.encode(text)) {
    const r = row.get(id);
    if (r === undefined) continue;         // 表に無いトークンは黙って捨てる
    if (id < 4) continue;                   // <s> </s> は意味を持たない
    for (let k = 0; k < D; k++) out[k] += TABLE[r * D + k];
    n++;
  }
  if (n === 0) return out;
  for (let k = 0; k < D; k++) out[k] /= n;
  return norm(out);
}

// 索引側も同じ方式で組む(両側が同じ空間にいなければ内積に意味がない)
const t0 = Date.now();
const V = new Float32Array(chunks.length * D);
chunks.forEach((c, i) => { V.set(encode(c.text), i * D); });
console.log(`静的索引を組んだ  ${((Date.now() - t0) / 1000).toFixed(1)}s(変換器を一度も呼んでいない)`);

const PICK = { 1: [3], 2: [0, 7], 4: [0, 2, 5, 7], 8: [0, 1, 2, 3, 4, 5, 6, 7] };
const byWork = new Map();
chunks.forEach((c, ci) => { if (!byWork.has(c.w)) byWork.set(c.w, []); byWork.get(c.w).push(ci); });
function subset(K) {
  const out = [];
  for (const [, cis] of byWork) {
    const n = cis.length;
    const idx = n >= 8 ? PICK[K] : [...new Set(PICK[K].map((i) => Math.min(n - 1, Math.round((i * (n - 1)) / 7))))];
    for (const i of idx) out.push(cis[i]);
  }
  return out;
}

const oracle = buildQueries(meta);
console.log(`候補語 ${oracle.queries.length} 件`);

function ranker(pool, own) {
  return (word, topK) => {
    const q = encode(word);
    const best = new Map();
    for (const ci of pool) {
      let s = 0; const o = ci * D;
      for (let k = 0; k < D; k++) s += q[k] * V[o + k];
      const w = own[ci];
      if (s > (best.get(w) ?? -2)) best.set(w, s);
    }
    return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK).map(([w]) => w);
  };
}

const trueOwn = chunks.map((c) => c.w);
console.log('\n--- G-01 静的トークン表 ---');
const res = {};
for (const K of [1, 2, 4, 8]) {
  const pool = subset(K);
  res[K] = gate01(oracle, ranker(pool, trueOwn), `K=${K}  チャンク ${pool.length}  int8 ${(pool.length * D / 1048576).toFixed(1)}MB`).median;
}
console.log('\n--- G-02 陰性対照 ---');
gate01(oracle, ranker(subset(4), shuffled(trueOwn)), 'K=4 入れ替え後');
fs.writeFileSync(path.join(STATIC, 'calib.json'), JSON.stringify(res, null, 1));
