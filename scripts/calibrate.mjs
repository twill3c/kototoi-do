// SPEC §4.1 の較正ゲート。埋め込みで引いた結果を埋め込みで評価しない(循環の禁止)。
// 評価に使うのは「書名」— 索引が一度も見ていない文字列である。
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';

const DIR = process.argv[2] ?? 'data/calib';
const { dims: D, meta, chunks } = JSON.parse(fs.readFileSync(path.join(DIR, 'chunks.json'), 'utf8'));
const buf = fs.readFileSync(path.join(DIR, 'vec_f32.bin'));
const V = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
console.log(`索引 ${meta.length} 作 / ${chunks.length} チャンク / ${D} 次元`);

/* ---------- 書名語オラクルの候補語を作る ---------- */
/*
  候補語は「語」でなければならない。
  書名から漢字の部分文字列を機械的に取ると 物/学/生/大/一/本 のような断片が並び、
  意味で引けるはずのないものを引けと要求することになる(loop_001 の VERIF-FALSE)。
  トークナイザで語かどうかを判定するのも駄目だった —— XLM-R は「東京」を 4 片に割る。

  そこで語であることを**実データで**保証する:
  青空文庫の全書名のうち、それ単独で一つの作品の書名になっているものだけを語とみなす。
  「海」「雨」「戦争」は作品名として実在するから語である。「一」「物」は実在しない。
  この判定に埋め込みは一切関与しない(循環の禁止)。
*/
import { loadWorks } from './lib-corpus.mjs';
const allTitles = loadWorks().map((w) => w.title);
const standalone = new Set();
for (const t of allTitles) {
  const s = t.trim();
  if (s.length >= 1 && s.length <= 4 && /^[一-鿿ぁ-ゖァ-ヺー]+$/.test(s)) standalone.add(s);
}
console.log(`単独で書名になっている語 ${standalone.size} 件(全 ${allTitles.length} 書名から)`);

const N = meta.length;
const LO = Math.max(5, Math.round(N * 0.004)), HI = Math.round(N * 0.05);
const queries = [];
for (const w of standalone) {
  const rel = new Set(meta.map((m, i) => (m.title.includes(w) ? i : -1)).filter((i) => i >= 0));
  if (rel.size >= LO && rel.size <= HI) queries.push({ w, rel });
}
queries.sort((a, b) => b.rel.size - a.rel.size);
queries.length = Math.min(queries.length, 40);
console.log(`候補語 ${queries.length} 件(索引内で ${LO}〜${HI} 作の書名に現れるもの)`);
console.log(`  ${queries.map((q) => q.w + '(' + q.rel.size + ')').join(' ')}`);

/* ---------- チャンクの間引き(G-05) ---------- */
// 1 作あたりのチャンク群から K 個を等間隔に選ぶ。8 本の埋め込みを 1 回計算すれば
// 1/2/4/8 の全変種を作れる — 選ぶ位置は真の K 本立て構築とほぼ同じ間隔になる。
const byWork = new Map();
chunks.forEach((c, ci) => { (byWork.get(c.w) ?? byWork.set(c.w, []).get(c.w)).push(ci); });
const PICK = { 1: [3], 2: [0, 7], 4: [0, 2, 5, 7], 8: [0, 1, 2, 3, 4, 5, 6, 7] };
function subset(K) {
  const out = [];
  for (const [, cis] of byWork) {
    const n = cis.length;
    const idx = n >= 8 ? PICK[K] : [...new Set(PICK[K].map((i) => Math.min(n - 1, Math.round((i * (n - 1)) / 7))))];
    for (const i of idx) out.push(cis[i]);
  }
  return out;
}

/* ---------- 検索 ---------- */
const dot = (q, ci) => { let s = 0; const o = ci * D; for (let k = 0; k < D; k++) s += q[k] * V[o + k]; return s; };
function search(qv, pool, chunkWork, topK = 50) {
  const best = new Map(); // 作品 → 最良スコア(max プーリング)
  for (const ci of pool) {
    const w = chunkWork[ci], s = dot(qv, ci);
    if (s > (best.get(w) ?? -2)) best.set(w, s);
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK);
}

const ex = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
const qout = await ex(queries.map((q) => 'query: ' + q.w), { pooling: 'mean', normalize: true });
const QV = queries.map((_, i) => Float32Array.from(qout.data.slice(i * D, (i + 1) * D)));

const trueWork = chunks.map((c) => c.w);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

function gate01(pool, chunkWork, label) {
  const ratios = [];
  for (let qi = 0; qi < queries.length; qi++) {
    const res = search(QV[qi], pool, chunkWork, 50);
    const hits = res.filter(([w]) => queries[qi].rel.has(w)).length;
    const exp = (50 * queries[qi].rel.size) / N; // 無作為に 50 件引いたときの期待命中数
    ratios.push(hits / exp);
  }
  const m = median(ratios);
  console.log(`  ${label}: 倍率中央値 ${m.toFixed(2)}  (最小 ${Math.min(...ratios).toFixed(1)} / 最大 ${Math.max(...ratios).toFixed(1)})`);
  return m;
}

console.log('\n--- G-05 チャンク数の選定 + G-01 書名語オラクル ---');
const g05 = {};
for (const K of [1, 2, 4, 8]) {
  const pool = subset(K);
  const mb = (pool.length * D) / 1e6; // int8 配布量
  const r = gate01(pool, trueWork, `K=${K}  チャンク ${pool.length}  int8 ${mb.toFixed(1)}MB`);
  g05[K] = { chunks: pool.length, mb: +mb.toFixed(2), ratio: +r.toFixed(2) };
}

console.log('\n--- G-02 陰性対照(チャンクと作品の対応を無作為に入れ替える) ---');
// 決定論的な擬似乱数(seed 固定)
let seed = 20260829;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffled = trueWork.slice();
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const g02 = gate01(subset(4), shuffled, 'K=4 入れ替え後');

fs.writeFileSync(path.join(DIR, 'calib.json'), JSON.stringify({ N, queries: queries.map((q) => ({ w: q.w, rel: q.rel.size })), g05, g02 }, null, 1));
console.log('\n判定  G-01(K=4) ' + (g05[4].ratio >= 8 ? '合格' : '不合格') + ' / G-02 ' + (g02 < 1.5 ? '合格' : '不合格'));
