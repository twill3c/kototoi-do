import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  実行系の寄せ替えが効いているかを、組み上がった束そのもので確かめる。

  Transformers.js の既定は WebGPU 込みの jsep 版で、wasm が 20.6 MB ある。
  next.config.ts で wasm 専用(10.6 MB)へ寄せているが、依存の版が上がると
  この寄せ替えは黙って外れうる。外れたことに気づく手立てをここに置く。
*/
const OUT = path.join(process.cwd(), "out");
const ORT = path.join(process.cwd(), "public/kotodoi/ort");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("実行系", () => {
  it("配るのは wasm 専用の版だけ(jsep 版を置かない)", () => {
    const files = fs.readdirSync(ORT).sort();
    expect(files).toEqual(["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]);
  });

  it("wasm が 12 MB を超えない(jsep 版なら 20.6 MB になる)", () => {
    const n = fs.statSync(path.join(ORT, "ort-wasm-simd-threaded.wasm")).size;
    expect(n / 1048576).toBeLessThan(12);
  });

  if (fs.existsSync(OUT)) {
    it("組み上がった束が jsep 版の**ファイル**を名指ししていない", () => {
      // jsepCreateDownloader などの内部 API 名は wasm 専用の束にも含まれる。
      // 見るべきは取りに行くファイル名であって、jsep という語ではない。
      const bad = walk(OUT)
        .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
        .filter((f) => /ort-wasm-simd-threaded\.jsep\./.test(fs.readFileSync(f, "utf8")))
        .map((f) => path.relative(OUT, f));
      expect(bad).toEqual([]);
    });

    it("組み上がった束が、置いてある wasm を名指ししている", () => {
      const hit = walk(OUT)
        .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
        .some((f) => fs.readFileSync(f, "utf8").includes("ort-wasm-simd-threaded.mjs"));
      expect(hit).toBe(true);
    });
  }
});
