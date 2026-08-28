import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import payload from "@/data/payload.json";

/*
  画面に出している数字が、配布物の実際のバイト数と合っているかを検める(SPEC N-08)。
  見積もりを画面に出して実物と食い違うのは、黙って重いものを配るより悪い。
*/
const DIR = path.join(process.cwd(), "public/kotodoi");
const built = fs.existsSync(path.join(DIR, "meta.json"));
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const mb = (n: number) => Math.round((n / 1048576) * 10) / 10;

if (!built) {
  describe.skip("配布量(未生成)", () => { it("生成後に検める", () => undefined); });
} else describe("配布量", () => {
  it("画面に出す索引の量が実物と一致する", () => {
    const n = ["vec.i8", "own.u16", "pos.u32", "meta.json"]
      .reduce((s, f) => s + fs.statSync(path.join(DIR, f)).size, 0);
    expect(payload.index).toBe(mb(n));
  });

  it("画面に出す読み取り機の量が実物と一致する", () => {
    expect(payload.model).toBe(mb(walk(path.join(DIR, "model")).reduce((s, f) => s + fs.statSync(f).size, 0)));
  });

  it("画面に出す実行系の量が実物と一致する", () => {
    expect(payload.runtime).toBe(mb(fs.statSync(path.join(DIR, "ort/ort-wasm-simd-threaded.wasm")).size));
  });

  it("合計が 60 MB を超えない(SPEC N-08)", () => {
    expect(payload.total).toBeLessThanOrEqual(60);
  });
});
