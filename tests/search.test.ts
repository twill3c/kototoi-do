import { describe, expect, it } from "vitest";
import { search, aozoraUrl, type Index, type IndexMeta } from "@/lib/kotodoi";

/*
  合成の索引で並べ替えそのものを検算する。埋め込みの質はここでは測らない
  (それは較正ゲート G-01 の仕事で、外部のオラクルが要る)。
  ここで確かめるのは「与えられたベクトルに対して正しい順序と正しいチャンクを返すか」だけ。
*/
function makeIndex(vectors: number[][], own: number[], dims = 4): Index {
  const meta: IndexMeta = {
    model: "test", dims, K: 2, nChunks: own.length, snipShard: 4,
    works: [...new Set(own)].sort((a, b) => a - b)
      .map((w) => [`00000${w}`, `作品${w}`, `著者${w}`, "NDC 913", 1000, "000123"]),
  };
  const vec = new Int8Array(own.length * dims);
  vectors.forEach((v, i) => v.forEach((x, k) => { vec[i * dims + k] = x; }));
  return { meta, vec, own: Uint16Array.from(own), pos: Uint32Array.from(own.map(() => 0)) };
}

describe("search", () => {
  it("内積の大きい順に作品を返す", () => {
    // 作品 0 のチャンクがクエリと完全一致、作品 2 は直交、作品 1 はその中間
    const idx = makeIndex(
      [[127, 0, 0, 0], [64, 64, 0, 0], [0, 0, 127, 0]],
      [0, 1, 2],
    );
    const q = Float32Array.from([1, 0, 0, 0]);
    const hits = search(idx, q, 3);
    expect(hits.map((h) => h.work)).toEqual([0, 1, 2]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[1].score).toBeGreaterThan(hits[2].score);
  });

  it("作品ごとに最も近いチャンクだけを採る(max プーリング)", () => {
    // 作品 0 は 2 本持ち、2 本目がクエリに近い
    const idx = makeIndex(
      [[0, 127, 0, 0], [127, 0, 0, 0], [100, 0, 0, 0]],
      [0, 0, 1],
    );
    const hits = search(idx, Float32Array.from([1, 0, 0, 0]), 2);
    expect(hits[0].work).toBe(0);
    // 採られたのは作品 0 の 2 本目(0 起点で 1 本目)であること
    expect(hits[0].chunkInWork).toBe(1);
    expect(hits[1].work).toBe(1);
  });

  it("点数は量子化の倍率を戻した値になる", () => {
    const idx = makeIndex([[127, 0, 0, 0]], [0]);
    const hits = search(idx, Float32Array.from([1, 0, 0, 0]), 1);
    expect(hits[0].score).toBeCloseTo(1, 6);
  });

  it("topK より多くは返さない", () => {
    const idx = makeIndex([[127, 0, 0, 0], [100, 0, 0, 0], [50, 0, 0, 0]], [0, 1, 2]);
    expect(search(idx, Float32Array.from([1, 0, 0, 0]), 2)).toHaveLength(2);
  });
});

describe("aozoraUrl", () => {
  it("人物 ID と作品 ID から図書カードの URL を組む", () => {
    expect(aozoraUrl(["000148", "こころ", "夏目漱石", "NDC 913", 100, "000148"]))
      .toBe("https://www.aozora.gr.jp/cards/000148/card148.html");
  });

  it("人物 ID が無ければリンクを出さない(推測で URL を作らない)", () => {
    expect(aozoraUrl(["000002", "三十三の死", "素木しづ", "NDC 913", 100, ""])).toBeNull();
  });
});
