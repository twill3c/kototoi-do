// 埋め込みの生データを、ブラウザが読む配布物に梱包する。
// 出力は public/kotodoi/ 配下。Vercel はこれをそのまま静的配信するだけである。
import fs from 'node:fs';
import path from 'node:path';
import { AOZORA } from './lib-corpus.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const SRC = arg('src', 'data/embed');
const OUT = arg('out', 'public/kotodoi');
const K = Number(arg('chunks', 4));
const SNIP_SHARD = 4;      // 2^4 = 16 作ごとに一節をまとめる
const SNIP_CHARS = 220;    // 引用として持たせる長さ

/* ---- 図書カード URL は青空文庫の公開目録から引く(URL 形式を推測しない) ---- */
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}
const cardUrl = new Map();
{
  const csv = fs.readFileSync(path.join(AOZORA, 'index_cache/list_person_all_extended_utf8.csv'), 'utf8');
  const lines = csv.split(/\r?\n/);
  const head = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ''));
  const iId = head.indexOf('作品ID'), iUrl = head.indexOf('図書カードURL');
  if (iId < 0 || iUrl < 0) throw new Error('目録 CSV の列名が変わっている');
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = parseCsvLine(lines[i]);
    // 作品 ID は 6 桁ゼロ詰めで works.json と揃える
    const id = String(f[iId]).padStart(6, '0');
    if (f[iUrl] && !cardUrl.has(id)) cardUrl.set(id, f[iUrl]);
  }
  console.log(`図書カード URL ${cardUrl.size} 件`);
}

/* ---- 埋め込みを読む ---- */
const { dims: D, K: srcK, meta, chunks } = JSON.parse(fs.readFileSync(path.join(SRC, 'chunks.json'), 'utf8'));
const buf = fs.readFileSync(path.join(SRC, 'vec_f32.bin'));
const V = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
console.log(`元データ ${meta.length} 作 / ${chunks.length} チャンク(1 作最大 ${srcK} 本)→ K=${K} に間引く`);

/* ---- 1 作あたり K 本へ間引く ---- */
const byWork = new Map();
chunks.forEach((c, ci) => { if (!byWork.has(c.w)) byWork.set(c.w, []); byWork.get(c.w).push(ci); });
const PICK = { 1: [3], 2: [0, 7], 4: [0, 2, 5, 7], 8: [0, 1, 2, 3, 4, 5, 6, 7] };
if (!PICK[K]) throw new Error(`K=${K} は 1/2/4/8 のいずれかであること`);
const keep = [];
for (const [w, cis] of [...byWork.entries()].sort((a, b) => a[0] - b[0])) {
  const n = cis.length;
  const idx = n >= srcK
    ? PICK[K]
    : [...new Set(PICK[K].map((i) => Math.min(n - 1, Math.round((i * (n - 1)) / (srcK - 1)))))];
  for (const i of idx) keep.push(cis[i]);
}
console.log(`採用チャンク ${keep.length}`);

/* ---- int8 に量子化して書き出す ---- */
// 埋め込みは正規化済みなので値域は [-1,1]。全体に同じ倍率 127 をかける。
// 倍率が全チャンク共通なので、内積の順位は float32 と変わらない(G-03 で実測する)。
const vec = new Int8Array(keep.length * D);
const own = new Uint16Array(keep.length);
const pos = new Uint32Array(keep.length);
keep.forEach((ci, j) => {
  const o = ci * D;
  for (let k = 0; k < D; k++) vec[j * D + k] = Math.max(-127, Math.min(127, Math.round(V[o + k] * 127)));
  own[j] = chunks[ci].w;
  pos[j] = chunks[ci].pos;
});

fs.mkdirSync(path.join(OUT, 's'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'vec.i8'), Buffer.from(vec.buffer));
fs.writeFileSync(path.join(OUT, 'own.u16'), Buffer.from(own.buffer));
fs.writeFileSync(path.join(OUT, 'pos.u32'), Buffer.from(pos.buffer));

/* ---- 目録 ---- */
const works = meta.map((m) => {
  const url = cardUrl.get(m.id) ?? '';
  // URL 全体でなく人物 ID だけ持つ(cards/{人物ID}/card{作品ID}.html)
  const pid = url.match(/\/cards\/(\d+)\//)?.[1] ?? '';
  return [m.id, m.title, m.author, m.ndc, m.chars, pid];
});
const missing = works.filter((w) => !w[5]).length;
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  model: 'Xenova/multilingual-e5-small', dims: D, K, nChunks: keep.length, snipShard: SNIP_SHARD, works,
}));
console.log(`目録 ${works.length} 件(図書カード未詳 ${missing} 件)`);

/* ---- 引用の一節。表示する分だけ取りに行けるよう小分けにする ---- */
const shards = new Map();
keep.forEach((ci, j) => {
  const w = own[j], s = w >> SNIP_SHARD;
  if (!shards.has(s)) shards.set(s, {});
  const bucket = shards.get(s);
  if (!bucket[w]) bucket[w] = [];
  bucket[w].push(chunks[ci].text.slice(0, SNIP_CHARS));
});
let snipBytes = 0;
for (const [s, obj] of shards) {
  const b = Buffer.from(JSON.stringify(obj));
  snipBytes += b.length;
  fs.writeFileSync(path.join(OUT, 's', `${s}.json`), b);
}

/* ---- 棚のページが使う集計。ページ側で数えなおさない(数の出どころを一つにする) ---- */
const NDC_LABEL = {
  '911': '詩歌', '912': '戯曲', '913': '小説・物語', '914': '評論・随筆・論説',
  '915': '日記・書簡・紀行', '916': '記録・手記・ルポルタージュ', '918': '近代小説集',
  '919': '漢詩文・日本漢文学', '910': '日本文学', '904': '文学論', '908': '文学全集',
  '929': 'その他の東洋文学', '933': '英米小説', '943': 'ドイツ小説', '953': 'フランス小説',
  '963': 'スペイン小説', '973': 'イタリア小説', '983': 'ロシア・ソヴィエト小説',
};
const byNdc = new Map(), byAuthor = new Map();
for (const w of works) {
  const code = (w[3].match(/\d{3}/) ?? [])[0] ?? '';
  const key = NDC_LABEL[code] ? code : 'other';
  byNdc.set(key, (byNdc.get(key) ?? 0) + 1);
  byAuthor.set(w[2], (byAuthor.get(w[2]) ?? 0) + 1);
}
const lenBuckets = [
  ['ごく短い', 0, 5_000], ['短い', 5_000, 20_000], ['中くらい', 20_000, 80_000],
  ['長い', 80_000, 300_000], ['たいへん長い', 300_000, Infinity],
];
fs.writeFileSync('src/data/shelf.json', JSON.stringify({
  total: works.length,
  ndc: [...byNdc.entries()].map(([c, n]) => ({ code: c, label: NDC_LABEL[c] ?? 'その他・分類なし', n }))
        .sort((a, b) => b.n - a.n),
  authors: [...byAuthor.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 60),
  authorTotal: byAuthor.size,
  lengths: lenBuckets.map(([label, lo, hi]) => ({ label, lo, hi: Number.isFinite(hi) ? hi : null, n: works.filter((w) => w[4] >= lo && w[4] < hi).length })),
  chars: works.reduce((s, w) => s + w[4], 0),
}, null, 1));
console.log(`棚の集計 → src/data/shelf.json(著者 ${byAuthor.size} 名)`);

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`
  vec.i8   ${mb(vec.byteLength)}
  own+pos  ${mb(own.byteLength + pos.byteLength)}
  meta     ${mb(fs.statSync(path.join(OUT, 'meta.json')).size)}
  一節      ${mb(snipBytes)}(${shards.size} 分割・引くときだけ取りに行く)
  ------------------------------------
  最初の問いで落ちる索引 = ${mb(vec.byteLength + own.byteLength + pos.byteLength + fs.statSync(path.join(OUT, 'meta.json')).size)}`);
