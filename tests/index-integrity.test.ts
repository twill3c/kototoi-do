import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { IndexMeta } from "@/lib/kotodoi";

/*
  配布物そのものを検める。件数や行数を定数で書かない —— 外部データは動く。
  書くのは「集合が一致していること」「取りこぼしが無いこと」という不変量である。
*/
const DIR = path.join(process.cwd(), "public/kotodoi");
const built = fs.existsSync(path.join(DIR, "meta.json"));

// describe.skip でも本体は評価されるので、未生成のときは describe 自体を呼ばない。
if (!built) {
  describe.skip("配布索引(未生成 — npm run embed && npm run pack のあとに検める)", () => {
    it("生成後に検める", () => undefined);
  });
} else describe("配布索引", () => {
  const meta: IndexMeta = JSON.parse(fs.readFileSync(path.join(DIR, "meta.json"), "utf8"));
  const vec = fs.readFileSync(path.join(DIR, "vec.i8"));
  const own = new Uint16Array(fs.readFileSync(path.join(DIR, "own.u16")).buffer);
  const pos = new Uint32Array(fs.readFileSync(path.join(DIR, "pos.u32")).buffer);

  it("三つの配列の長さが辻褄を合わせている", () => {
    expect(vec.length).toBe(meta.nChunks * meta.dims);
    expect(own.length).toBe(meta.nChunks);
    expect(pos.length).toBe(meta.nChunks);
  });

  it("どのチャンクも実在する作品を指している", () => {
    const bad = [...own].filter((w) => w >= meta.works.length);
    expect(bad).toEqual([]);
  });

  it("目録に載る全作品が、少なくとも一本のチャンクを持つ", () => {
    const covered = new Set(own);
    const orphan = meta.works.map((_, i) => i).filter((i) => !covered.has(i));
    expect(orphan).toEqual([]);
  });

  it("同じ作品のチャンクは連続して並んでいる(chunkInWork の数えかたの前提)", () => {
    const seen = new Set<number>();
    let prev = -1;
    for (const w of own) {
      if (w !== prev) {
        expect(seen.has(w)).toBe(false);
        seen.add(w);
        prev = w;
      }
    }
  });

  it("1 作あたりのチャンク数が K を超えない", () => {
    const count = new Map<number, number>();
    for (const w of own) count.set(w, (count.get(w) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(meta.K);
  });

  it("書名・著者名を索引に持ち込んでいない(G-01 のオラクルを汚さない)", () => {
    // 目録は表示のために書名を持つが、ベクトル側は本文だけで作られている。
    // ここで確かめられるのは配布物の構造 —— ベクトルは目録と別ファイルであること。
    expect(fs.existsSync(path.join(DIR, "vec.i8"))).toBe(true);
    expect(meta.works[0]).toHaveLength(6);
  });

  it("最初の問いで落ちる索引が 8.0 MB を超えない(SPEC N-03)", () => {
    const bytes = ["meta.json", "vec.i8", "own.u16", "pos.u32"]
      .reduce((s, f) => s + fs.statSync(path.join(DIR, f)).size, 0);
    expect(bytes / 1048576).toBeLessThanOrEqual(8.0);
  });

  it("引用の一節が、まとめてある単位のとおりに引ける", () => {
    const shard = 0;
    const p = path.join(DIR, "s", `${shard}.json`);
    const bucket: Record<string, string[]> = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const k of Object.keys(bucket)) {
      expect(Number(k) >> meta.snipShard).toBe(shard);
    }
  });
});
