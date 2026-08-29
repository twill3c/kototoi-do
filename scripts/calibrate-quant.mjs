/*
  G-03 量子化の保存。float32 のままの索引と int8 に落とした索引で、上位 10 件を比べる。
  倍率は全チャンク共通(127 倍)なので順位は理屈のうえでは変わらないが、
  丸めの誤差が同点付近の順位を入れ替えうる。理屈でなく実測で確かめる。
*/
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import { buildQueries } from './lib-oracle.mjs';

const DIR = process.argv[2] ?? 'data/calib';
const K = Number(process.argv[3] ?? 4);
const { dims: D, meta, chunks } = JSON.parse(fs.readFileSync(path.join(DIR, 'chunks.json'), 'utf8'));
const buf = fs.readFileSync(path.join(DIR, 'vec_f32.bin'));
const F = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

const PICK = { 1: [3], 2: [0, 7], 4: [0, 2, 5, 7], 8: [0, 1, 2, 3, 4, 5, 6, 7] };
const byWork = new Map();
chunks.forEach((c, ci) => { if (!byWork.has(c.w)) byWork.set(c.w, []); byWork.get(c.w).push(ci); });
const pool = [];
for (const [, cis] of byWork) {
  const n = cis.length;
  const idx = n >= 8 ? PICK[K] : [...new Set(PICK[K].map((i) => Math.min(n - 1, Math.round((i * (n - 1)) / 7))))];
  for (const i of idx) pool.push(cis[i]);
}
// (甲)素朴な量子化 —— 全体を 127 倍して丸める
const Q0 = new Int8Array(pool.length * D);
pool.forEach((ci, j) => {
  for (let k = 0; k < D; k++) Q0[j * D + k] = Math.max(-127, Math.min(127, Math.round(F[ci * D + k] * 127)));
});

/*
  (乙)次元ごとの中心と倍率。
    score_j = Σ_k q_k · v_jk
            = Σ_k q_k · mu_k          … 全チャンク共通の定数(順位に効かない)
            + Σ_k (q_k · s_k) · c_jk  … c を int8 に落とし、s はクエリ側へ畳み込む
  埋め込みは一箇所に固まっているので、mu を抜くと値の幅が縮み、
  同じ int8 でも刻みが細かくなる。順位は理屈のうえで完全に保たれる。
*/
const mu = new Float64Array(D);
for (const ci of pool) for (let k = 0; k < D; k++) mu[k] += F[ci * D + k] / pool.length;
const sc = new Float64Array(D);
for (const ci of pool) for (let k = 0; k < D; k++) sc[k] = Math.max(sc[k], Math.abs(F[ci * D + k] - mu[k]));
const Q1 = new Int8Array(pool.length * D);
pool.forEach((ci, j) => {
  for (let k = 0; k < D; k++) {
    const c = (F[ci * D + k] - mu[k]) / (sc[k] || 1);
    Q1[j * D + k] = Math.max(-127, Math.min(127, Math.round(c * 127)));
  }
});

const { queries } = buildQueries(meta);
const ex = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });

const top = (score) => {
  const best = new Map();
  pool.forEach((ci, j) => {
    const w = chunks[ci].w, s = score(ci, j);
    if (s > (best.get(w) ?? -Infinity)) best.set(w, s);
  });
  return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
};

const stat = { 甲: { agree: 0, exact: 0 }, 乙: { agree: 0, exact: 0 } };
for (const q of queries) {
  const out = await ex('query: ' + q.w, { pooling: 'mean', normalize: true });
  const v = Float32Array.from(out.data);
  const base = top((ci) => { let s = 0; for (let k = 0; k < D; k++) s += v[k] * F[ci * D + k]; return s; });
  const a = top((_, j) => { let s = 0; for (let k = 0; k < D; k++) s += v[k] * Q0[j * D + k]; return s; });
  // 倍率をクエリ側へ畳み込む
  const vs = new Float64Array(D);
  for (let k = 0; k < D; k++) vs[k] = v[k] * (sc[k] || 1);
  const b = top((_, j) => { let s = 0; for (let k = 0; k < D; k++) s += vs[k] * Q1[j * D + k]; return s; });
  for (const [name, r] of [['甲', a], ['乙', b]]) {
    stat[name].agree += base.filter((w) => r.includes(w)).length / 10;
    if (base.join(',') === r.join(',')) stat[name].exact++;
  }
}
console.log(`クエリ ${queries.length} 件 / K=${K} / チャンク ${pool.length}`);
for (const [name, label] of [['甲', '全体を 127 倍'], ['乙', '次元ごとの中心と倍率']]) {
  const r = stat[name].agree / queries.length;
  console.log(`  ${label}: 上位10件の一致率 ${(r * 100).toFixed(1)}% / 並び順まで一致 ${stat[name].exact}/${queries.length}`);
}
const rate = stat['乙'].agree / queries.length;
console.log(rate >= 0.95 ? 'G-03 合格(乙を採る)' : 'G-03 不合格');
process.exit(rate >= 0.95 ? 0 : 1);
