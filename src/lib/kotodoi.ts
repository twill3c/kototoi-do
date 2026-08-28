/*
  言問いの検索。すべて閲覧者の端末で動く(SPEC N-01/N-02)。
  索引はビルド前に焼いた静的資産で、問い合わせ文はどこへも送られない。
*/

// 人物 ID はカード URL の組み立てに要る。青空文庫のカードは
// cards/{人物ID}/card{作品ID}.html にあり、作品 ID だけでは辿れない。
export type WorkRow = [id: string, title: string, author: string, ndc: string, chars: number, personId: string];

export type IndexMeta = {
  model: string;
  dims: number;
  K: number;
  nChunks: number;
  snipShard: number; // 何作ごとに一節ファイルをまとめてあるか
  works: WorkRow[];
};

export type Index = {
  meta: IndexMeta;
  vec: Int8Array;
  own: Uint16Array;
  pos: Uint32Array;
};

export type Hit = {
  work: number;
  score: number;
  chunk: number; // 索引全体でのチャンク番号
  chunkInWork: number;
};

const BASE = "/kotodoi";

export async function loadIndex(onProgress?: (frac: number, label: string) => void): Promise<Index> {
  onProgress?.(0.02, "蔵書目録を受け取っています");
  const meta: IndexMeta = await (await fetch(`${BASE}/meta.json`)).json();
  onProgress?.(0.1, "索引を受け取っています");
  const [vb, ob, pb] = await Promise.all([
    fetch(`${BASE}/vec.i8`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}/own.u16`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}/pos.u32`).then((r) => r.arrayBuffer()),
  ]);
  onProgress?.(0.45, "索引を開いています");
  return { meta, vec: new Int8Array(vb), own: new Uint16Array(ob), pos: new Uint32Array(pb) };
}

/**
 * 作品ごとに最良のチャンクを採る(max プーリング)。
 * int8 のまま内積を取る — 量子化は全チャンクに同じ倍率でかかっているので、
 * 順位は float32 と変わらない(SPEC G-03 で実測して確かめる)。
 */
export function search(idx: Index, q: Float32Array, topK = 12): Hit[] {
  const D = idx.meta.dims;
  const n = idx.own.length;
  const bestScore = new Float32Array(idx.meta.works.length).fill(-Infinity);
  const bestChunk = new Int32Array(idx.meta.works.length).fill(-1);
  const { vec, own } = idx;
  for (let c = 0; c < n; c++) {
    let s = 0;
    const o = c * D;
    for (let k = 0; k < D; k++) s += q[k] * vec[o + k];
    const w = own[c];
    if (s > bestScore[w]) { bestScore[w] = s; bestChunk[w] = c; }
  }
  const order: number[] = [];
  for (let w = 0; w < bestScore.length; w++) if (bestChunk[w] >= 0) order.push(w);
  order.sort((a, b) => bestScore[b] - bestScore[a]);
  return order.slice(0, topK).map((w) => {
    const c = bestChunk[w];
    // 同じ作品のチャンクは連続して並んでいる。作品内での何本目かを数える
    let first = c;
    while (first > 0 && own[first - 1] === w) first--;
    return { work: w, score: bestScore[w] / 127, chunk: c, chunkInWork: c - first };
  });
}

/** 引用の一節を取りに行く。表示する分だけ、まとめてある単位で取る。 */
export async function loadSnippets(idx: Index, hits: Hit[]): Promise<Map<number, string[]>> {
  const shards = new Set(hits.map((h) => h.work >> idx.meta.snipShard));
  const out = new Map<number, string[]>();
  await Promise.all(
    [...shards].map(async (s) => {
      const r = await fetch(`${BASE}/s/${s}.json`);
      if (!r.ok) return;
      const j: Record<string, string[]> = await r.json();
      for (const [k, v] of Object.entries(j)) out.set(Number(k), v);
    }),
  );
  return out;
}

/** 青空文庫の図書カード。人物 ID が無い作品にはリンクを出さない(F-08 は should)。 */
export function aozoraUrl(w: WorkRow): string | null {
  const personId = w[5];
  if (!personId) return null;
  return `https://www.aozora.gr.jp/cards/${personId}/card${Number(w[0])}.html`;
}
