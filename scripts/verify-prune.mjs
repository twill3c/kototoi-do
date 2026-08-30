/*
  刈ったあとの模型が、刈る前と同じベクトルを出すかを検算する(SPEC G-06)。
  語彙を削ると Unigram の分かち方が変わりうる。ここを測らずに配ると、
  索引(刈る前の模型で作った)と読み取り機(刈った模型)が別の空間を向く。

  1 問ずつ通すこと。まとめて通すと、束の中でいちばん長い列に合わせて詰め物が入り、
  刈った側だけ列長が変わったときに詰め物の量が食い違って、模型の差でないものが差として出る。
  閲覧時は 1 問ずつ通すので、検算もそれに揃える
  (loop_001 で束にして測り、0.996 という偽の差を追いかけた)。
*/
import { pipeline, env } from '@huggingface/transformers';

const JP_QUERIES = [
  '雨の日に読みたい', '海と船が出てくる話', '親子の別れ', '都会でひとり暮らす',
  '山を歩く', '食べものの話', '戦争のあとの町', '子どもの頃の夏',
  '猫が出てくる話', '手紙のやりとり', '汽車に乗って旅する', '病気と死について',
  '恋に破れる話', '東京の下町', '古い家と庭', '別れた人のこと',
];
// 刈った範囲。ここが落ちるのは想定どおりで、ゲートの対象にしない。
const OUT_OF_SCOPE = ['молодость', 'a story about the sea'];  // text-hygiene:allow

async function load(local) {
  env.allowRemoteModels = !local;
  env.allowLocalModels = local;
  if (local) env.localModelPath = './public/kotodoi/';
  return pipeline('feature-extraction', local ? 'model' : 'Xenova/multilingual-e5-small', { dtype: 'q8' });
}

const ALL = [...JP_QUERIES, ...OUT_OF_SCOPE];
const full = await load(false);
const A = [];
for (const q of ALL) A.push(Float32Array.from((await full('query: ' + q, { pooling: 'mean', normalize: true })).data));
const pruned = await load(true);
const B = [];
for (const q of ALL) B.push(Float32Array.from((await pruned('query: ' + q, { pooling: 'mean', normalize: true })).data));

const D = A[0].length;
const cos = (i) => { let s = 0; for (let k = 0; k < D; k++) s += A[i][k] * B[i][k]; return s; };

console.log('  類似度   クエリ');
let worst = 1, worstQ = '';
ALL.forEach((q, i) => {
  const s = cos(i);
  const inScope = i < JP_QUERIES.length;
  if (inScope && s < worst) { worst = s; worstQ = q; }
  console.log(`  ${s.toFixed(6)}  ${q}${inScope ? '' : '   ← 刈った範囲(ゲート対象外)'}`);
});

console.log(`\n日本語クエリ ${JP_QUERIES.length} 件の最悪 ${worst.toFixed(6)}(${worstQ})`);
const pass = worst >= 0.9999;
console.log(pass ? 'G-06 合格 — 刈る前と同じベクトルを出している' : 'G-06 不合格 — 日本語の分かち方が変わっている');
process.exit(pass ? 0 : 1);
