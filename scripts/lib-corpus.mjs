import fs from 'node:fs';
import path from 'node:path';

export const AOZORA = process.env.AOZORA_DIR ?? 'C:/_ClaudeCode/aozora-sakuin/data';

/** works.json から作品メタを読む。青空文庫の正規化済み本文が実在するものだけを返す。 */
export function loadWorks({ limit = Infinity, stride = 1 } = {}) {
  const raw = JSON.parse(fs.readFileSync(path.join(AOZORA, 'works.json'), 'utf8'));
  // works.json は {n, excluded, works}。excluded は空配列なので
  // Object.values().find(Array.isArray) では掴めない — キー名で取る。
  const arr = Array.isArray(raw) ? raw : raw.works;
  if (!Array.isArray(arr)) throw new Error('works.json に works 配列が無い');
  const out = [];
  for (let i = 0; i < arr.length && out.length < limit; i += stride) {
    const w = arr[i];
    const p = path.join(AOZORA, 'normalized', `${w.id}.txt`);
    if (!fs.existsSync(p)) continue;
    out.push(w);
  }
  return out;
}

export function readBody(id) {
  return fs.readFileSync(path.join(AOZORA, 'normalized', `${id}.txt`), 'utf8')
    .replace(/[ \t\u3000]+/g, '')
    .replace(/\r?\n+/g, '\n')
    .trim();
}

/**
 * 本文から K 個の窓を等間隔に切り出す。
 * 索引に入れるのは本文だけで、書名・著者名は決して混ぜない(SPEC G-01 の前提)。
 */
export function chunkBody(body, K, W = 400) {
  const flat = body.replace(/\n/g, '');
  if (flat.length <= W) return flat.length >= 60 ? [{ pos: 0, text: flat }] : [];
  const span = flat.length - W;
  const chunks = [];
  for (let i = 0; i < K; i++) {
    const pos = K === 1 ? Math.floor(span / 2) : Math.round((span * i) / (K - 1));
    chunks.push({ pos, text: flat.slice(pos, pos + W) });
  }
  // 同一位置の重複を落とす(短い作品では窓が重なる)
  const seen = new Set();
  return chunks.filter((c) => (seen.has(c.pos) ? false : (seen.add(c.pos), true)));
}
