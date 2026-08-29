/*
  G-04 人手ラベル用。出荷する索引そのものに問い、上位 10 件を判定できる形で並べる。
  ここで測るのは「人が読んで納得するか」であって、書名オラクル(G-01)とは別の物差しである。
  判定した結果は docs/LABELS.md に、判定日と判断基準ごと残す。
*/
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';

const DIR = process.argv[2] ?? 'public/kotodoi';
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf8'));
const vec = new Int8Array(fs.readFileSync(path.join(DIR, 'vec.i8')).buffer);
const own = new Uint16Array(fs.readFileSync(path.join(DIR, 'own.u16')).buffer);
const D = meta.dims;

const QUERIES = [
  '雨の日に読みたい', '海と船が出てくる話', '親子の別れ', '都会でひとり暮らす',
  '山を歩く', '食べものの話', '戦争のあとの町', '子どもの頃の夏',
  '猫や犬が出てくる話', '手紙のやりとり', '汽車に乗って旅する', '病と死をめぐる話',
  '恋に破れる話', '職人の仕事ぶり', '雪国の暮らし', '外国で暮らす日本人',
  '音楽と楽器の話', '幽霊や化けもの', '貧しさと金の話', '老いてゆくこと',
];

const ex = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
const scale = Float32Array.from(meta.scale);

for (const q of QUERIES) {
  const out = await ex('query: ' + q, { pooling: 'mean', normalize: true });
  const v = Float32Array.from(out.data);
  const qs = new Float32Array(D);
  for (let k = 0; k < D; k++) qs[k] = v[k] * scale[k];
  const best = new Map(), bestC = new Map();
  for (let c = 0; c < own.length; c++) {
    let s = 0; const o = c * D;
    for (let k = 0; k < D; k++) s += qs[k] * vec[o + k];
    const w = own[c];
    if (s > (best.get(w) ?? -Infinity)) { best.set(w, s); bestC.set(w, c); }
  }
  const top = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\n■ ${q}`);
  top.forEach(([w], i) => {
    const m = meta.works[w];
    console.log(`  ${String(i + 1).padStart(2)}. ${m[1]} / ${m[2]} [${m[3]}]`);
  });
}
