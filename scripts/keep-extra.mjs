// 刈ってはいけないトークンを、元のトークナイザに実際に聞いて集める。
// e5 は "query: " / "passage: " の接頭辞を要求するので、ここが割れると
// 索引側と問い合わせ側が別のベクトルを出す(loop_001 で実際に起きた)。
import fs from 'node:fs';
import { AutoTokenizer } from '@huggingface/transformers';

const ESSENTIAL = [
  'query: ', 'passage: ', 'query', 'passage',
  '0123456789', '、。「」『』・ー〜',
  '.,:;!?()[]{}"\'-_/\@#%&*+=<>|~`^$',
  'The quick brown fox jumps over the lazy dog',
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',
];

const tok = await AutoTokenizer.from_pretrained('Xenova/multilingual-e5-small');
const ids = new Set();
for (const s of ESSENTIAL) for (const id of tok.encode(s)) ids.add(id);
// 1 文字ずつも通す(単独で来たときに割れないように)
for (const s of ESSENTIAL) for (const ch of s) for (const id of tok.encode(ch)) ids.add(id);

fs.writeFileSync('data/keep-extra.json', JSON.stringify({ ids: [...ids].sort((a, b) => a - b) }));
console.log(`必ず残すトークン ${ids.size} 件 → data/keep-extra.json`);
console.log('  "query: " →', tok.encode('query: ').join(','), '=', tok.encode('query: ').map((i) => tok.model.vocab[i][0]).join('|'));
