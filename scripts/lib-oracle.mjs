/*
  書名語オラクル(SPEC G-01)。計器は一つに揃える —— 変換器方式と静的表方式を
  別々の物差しで測ったら、比較にならない。
*/
import { loadWorks } from './lib-corpus.mjs';

/** 青空文庫の全書名のうち、それ単独で一作の書名になっているものを「語」とみなす。 */
export function standaloneWords() {
  const set = new Set();
  for (const w of loadWorks()) {
    const s = w.title.trim();
    if (s.length >= 1 && s.length <= 4 && /^[一-鿿ぁ-ゖァ-ヺー]+$/.test(s)) set.add(s);
  }
  return set;
}

/** 索引に入っている作品に対して、頻度が手ごろな候補語を最大 40 件選ぶ。 */
export function buildQueries(meta, max = 40) {
  const N = meta.length;
  const LO = Math.max(5, Math.round(N * 0.004)), HI = Math.round(N * 0.05);
  const qs = [];
  for (const w of standaloneWords()) {
    const rel = new Set(meta.map((m, i) => (m.title.includes(w) ? i : -1)).filter((i) => i >= 0));
    if (rel.size >= LO && rel.size <= HI) qs.push({ w, rel });
  }
  qs.sort((a, b) => b.rel.size - a.rel.size);
  qs.length = Math.min(qs.length, max);
  return { queries: qs, LO, HI, N };
}

export const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * top-50 に候補語を書名に持つ作品がどれだけ集まるかを、無作為に引いたときの
 * 期待値との倍率で測る。倍率 1.0 = 何も引けていない。
 */
export function gate01({ queries, N }, rank, label) {
  const ratios = [];
  for (const q of queries) {
    const res = rank(q.w, 50);
    const hits = res.filter((w) => q.rel.has(w)).length;
    ratios.push(hits / ((50 * q.rel.size) / N));
  }
  const m = median(ratios);
  if (label) console.log(`  ${label}: 倍率中央値 ${m.toFixed(2)}  (最小 ${Math.min(...ratios).toFixed(1)} / 最大 ${Math.max(...ratios).toFixed(1)})`);
  return { median: m, ratios };
}

/** 決定論的な入れ替え(陰性対照 G-02 用)。 */
export function shuffled(arr, seed = 20260829) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
