import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  書き出したものを検める。SPEC の N-01/N-02/N-05 は「作るときの心がけ」ではなく、
  出来上がりに対する検査でなければ意味がない。
*/
const OUT = path.join(process.cwd(), "out");
const built = fs.existsSync(OUT);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 本文から外へ出るリンク(青空文庫の図書カード等)は当然あってよい。
// 禁じているのは「ページを組み立てるために外部ホストを取りに行くこと」である。
const ALLOWED_LINK_HOSTS = [
  "www.aozora.gr.jp", "aozora.gr.jp", "github.com", "claude.ai",
  "app-menu-amber.vercel.app", "huggingface.co", "kototoi-do.vercel.app",
];

if (!built) {
  describe.skip("書き出し(未生成 — npm run build のあとに検める)", () => {
    it("生成後に検める", () => undefined);
  });
} else describe("書き出し", () => {
  const files = walk(OUT);

  it("ページを組み立てるための外部ホスト参照が無い(SPEC N-02)", () => {
    const bad: string[] = [];
    for (const f of files.filter((f) => /\.(html|js|css)$/.test(f))) {
      const t = fs.readFileSync(f, "utf8");
      // src= / href= の属性値と、fetch/import の引数に現れる絶対 URL を見る
      for (const m of t.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/g)) {
        const host = new URL(m[1]).host;
        if (!ALLOWED_LINK_HOSTS.includes(host)) bad.push(`${path.relative(OUT, f)} → ${host}`);
      }
      for (const m of t.matchAll(/\b(?:fetch|importScripts)\s*\(\s*["'](https?:\/\/[^"']+)["']/g)) {
        bad.push(`${path.relative(OUT, f)} が実行時に取りに行く → ${m[1]}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("画像バイナリを配っていない(SPEC N-05)", () => {
    const imgs = files.filter((f) => /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(f));
    expect(imgs.map((f) => path.relative(OUT, f))).toEqual([]);
  });

  it("サーバ関数の成果物が無い(SPEC N-01)", () => {
    const fns = files.filter((f) => /\.func[\/]/.test(f) || /\/api\/.*\.js$/.test(f));
    expect(fns.map((f) => path.relative(OUT, f))).toEqual([]);
  });

  it("約束したページが全部ある", () => {
    for (const p of ["index.html", "tana/index.html", "aruji/index.html", "annai/index.html", "oshirase/index.html"]) {
      expect(fs.existsSync(path.join(OUT, p)), p).toBe(true);
    }
  });

  it("架空である旨が全ページの下に出ている", () => {
    for (const f of files.filter((f) => f.endsWith(".html"))) {
      expect(fs.readFileSync(f, "utf8"), path.relative(OUT, f)).toContain("架空の古書店");
    }
  });
});

describe("フッタ", () => {
  const files = fs.existsSync(OUT) ? walk(OUT).filter((f) => f.endsWith(".html")) : [];
  it.runIf(files.length > 0)("仮のリンクを出荷していない", () => {
    const bad = files.filter((f) => /PLACEHOLDER/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(OUT, f));
    expect(bad).toEqual([]);
  });
  it.runIf(files.length > 0)("規約の 5 項目が全ページに揃っている", () => {
    for (const f of files) {
      const t = fs.readFileSync(f, "utf8");
      for (const label of ["MIT License", "GitHub", "言問堂の歩き方", "言問堂の設計図", "App Menu"]) {
        expect(t, `${path.relative(OUT, f)} に「${label}」が無い`).toContain(label);
      }
    }
  });
});
