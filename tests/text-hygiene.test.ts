import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  日本語の本文に、字形の似た別の文字が紛れ込むことがある(SPEC N-06)。
  キリル文字の а е о с р や、全角ラテンの Ａ は、目で見ても気づけない。
*/
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|md)$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = [...walk(path.join(process.cwd(), "src")), path.join(process.cwd(), "SPEC.md")];

describe("文字種", () => {
  it("キリル文字が混ざっていない", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const t = fs.readFileSync(f, "utf8");
      t.split("\n").forEach((line, i) => {
        const m = line.match(/[Ѐ-ӿ]/g);
        if (m) bad.push(`${path.relative(process.cwd(), f)}:${i + 1} ${m.join("")}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("全角ラテン英数が混ざっていない", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const t = fs.readFileSync(f, "utf8");
      t.split("\n").forEach((line, i) => {
        const m = line.match(/[Ａ-Ｚａ-ｚ０-９]/g);
        if (m) bad.push(`${path.relative(process.cwd(), f)}:${i + 1} ${m.join("")}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
