/*
  静的トークン表(model2vec 方式)を作る。
  各トークンを単独で模型に通し、その出力を「そのトークンの意味ベクトル」として表に焼く。
  文のベクトルは、含まれるトークンのベクトルの平均で近似する。

  こうすると閲覧側に変換器も ort の wasm も要らなくなり、配布量が一桁下がる。
  そのかわり文脈を捨てるので質は落ちる —— どれだけ落ちるかを G-01 で測って決める。
*/
import fs from 'node:fs';
import path from 'node:path';
import { AutoModel, AutoTokenizer, Tensor } from '@huggingface/transformers';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const VOCAB = arg('vocab', 'data/vocab-used.json');
const OUT = arg('out', 'data/static');
const BATCH = 128;

fs.mkdirSync(OUT, { recursive: true });
const tok = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-small');
const model = await AutoModel.from_pretrained('Xenova/multilingual-e5-small', { dtype: 'q8' });

/*
  対象トークンの選び方。コーパスを全部トークン化して実際に出たものを数える手もあるが、
  それだと「コーパスに無いが問い合わせには来る語」を落とす。
  語彙表を文字種で絞るほうが速く、覆いも広い。
*/
let ids;
if (fs.existsSync(VOCAB)) {
  ids = [...new Set([0, 1, 2, 3, ...JSON.parse(fs.readFileSync(VOCAB, 'utf8')).used])].sort((a, b) => a - b);
  console.log(`実測の語彙 ${VOCAB} から ${ids.length} 件`);
} else {
  const vocab = tok.model.vocab.map((v) => v[0]);
  const keep = [0, 1, 2, 3];
  for (let i = 4; i < vocab.length; i++) {
    const t = vocab[i].replace(/^▁/, '');
    if (!t) continue;
    // 日本語(かな・漢字)を含むもの、または短い ASCII(数字・記号・ローマ字)
    if (/[぀-ヿ㐀-䶿一-鿿]/.test(t) || (/^[ -~]+$/.test(t) && t.length <= 8)) keep.push(i);
  }
  ids = keep;
  console.log(`語彙表を文字種で絞って ${ids.length} 件(全 ${vocab.length} 件から)`);
}

const D = 384;
const table = new Float32Array(ids.length * D);
const t0 = Date.now();
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const L = 3; // <s> トークン </s>
  const flat = new BigInt64Array(batch.length * L);
  batch.forEach((id, j) => { flat[j * L] = 0n; flat[j * L + 1] = BigInt(id); flat[j * L + 2] = 2n; });
  const mask = new BigInt64Array(batch.length * L).fill(1n);
  const out = await model({
    input_ids: new Tensor('int64', flat, [batch.length, L]),
    attention_mask: new Tensor('int64', mask, [batch.length, L]),
  });
  const h = out.last_hidden_state.data; // [B, L, D]
  for (let j = 0; j < batch.length; j++) {
    for (let k = 0; k < D; k++) {
      let s = 0;
      for (let p = 0; p < L; p++) s += h[(j * L + p) * D + k];
      table[(i + j) * D + k] = s / L;
    }
  }
  if ((i / BATCH) % 20 === 0 || i + BATCH >= ids.length) {
    const done = Math.min(i + BATCH, ids.length), el = (Date.now() - t0) / 1000;
    console.log(`  ${done}/${ids.length}  経過 ${el.toFixed(0)}s  残り ${(el / done * (ids.length - done)).toFixed(0)}s`);
  }
}

fs.writeFileSync(path.join(OUT, 'table_f32.bin'), Buffer.from(table.buffer));
fs.writeFileSync(path.join(OUT, 'ids.json'), JSON.stringify({ dims: D, ids }));
console.log(`静的表 → ${OUT}  ${(table.byteLength / 1048576).toFixed(1)} MB (float32)  int8 なら ${(ids.length * D / 1048576).toFixed(1)} MB`);
