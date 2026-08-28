// XLM-R の語彙 250,002 のうち、日本語コーパスが実際に使うトークンだけを数える。
// 語彙表が模型の大半を占めるため、ここを削れば配布量が落ちる(SPEC N-08)。
import fs from 'node:fs';
import { AutoTokenizer } from '@huggingface/transformers';
import { loadWorks, readBody } from './lib-corpus.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const LIMIT = Number(arg('limit', Infinity));
const OUT = arg('out', 'data/vocab-used.json');

const tok = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-small');
const works = loadWorks({ limit: LIMIT });
console.log(`${works.length} 作をトークン化する`);

const used = new Set();
const t0 = Date.now();
let chars = 0;
for (let i = 0; i < works.length; i++) {
  let body;
  try { body = readBody(works[i].id); } catch { continue; }
  chars += body.length;
  // 長文は分割して食わせる(トークナイザの入力長に依存しないよう素で回す)
  for (let p = 0; p < body.length; p += 4000) {
    const ids = tok.encode(body.slice(p, p + 4000));
    for (const id of ids) used.add(id);
  }
  // 書名・著者名は索引に入れないが、問い合わせ語としては来るので語彙には残す
  for (const id of tok.encode(works[i].title + ' ' + works[i].author)) used.add(id);
  if (i % 250 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`  ${i}/${works.length}  異なりトークン ${used.size}  経過 ${el.toFixed(0)}s  残り ${(el / (i + 1) * (works.length - i)).toFixed(0)}s`);
  }
}
console.log(`本文 ${(chars / 1e6).toFixed(1)}M 字 / 異なりトークン ${used.size} / 全語彙 ${tok.model.vocab.length}`);
fs.writeFileSync(OUT, JSON.stringify({ total: tok.model.vocab.length, chars, used: [...used].sort((a, b) => a - b) }));
console.log('書き出し →', OUT);
