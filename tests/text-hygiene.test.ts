import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  日本語の本文に、字形の似た別の文字が紛れ込むことがある(SPEC N-06)。
  キリル小文字の a e o c p や、全角ラテンの A は、目で見ても気づけない。

  外国語を意図して書く場所はある(刈った語彙の範囲を示す見本など)。
  それは**理由つきで名指しして許す**。名指しの無い混入はすべて落とす。
*/

const ALLOWED: Record<string, string> = {
  "scripts/verify-prune.mjs":
    "刈った語彙の範囲外に何が落ちるかを示す見本として、ロシア語と英語のクエリを置いている",
  "docs/CALIBRATION.md":
    "上と同じ見本の測定結果を記録している",
  "tests/text-hygiene.test.ts":
    "検出器そのもの。探している文字を書かなければ探せない",
};

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|py|css|md)$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = [
  ...["src", "scripts", "harness", "tests"].flatMap((d) => walk(path.join(process.cwd(), d))),
  ...["SPEC.md", "TEST_SPEC.md", "README.md", "docs/CALIBRATION.md"].map((f) => path.join(process.cwd(), f)),
].filter((f) => fs.existsSync(f));

const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/");

function scan(re: RegExp): string[] {
  const bad: string[] = [];
  for (const f of FILES) {
    const r = rel(f);
    if (r in ALLOWED) continue;
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      const m = line.match(re);
      if (m) bad.push(`${r}:${i + 1} ${m.join("")}`);
    });
  }
  return bad;
}

describe("文字種", () => {
  it("キリル文字が混ざっていない", () => {
    expect(scan(/[Ѐ-ӿ]/g)).toEqual([]);
  });

  it("全角ラテン英数が混ざっていない", () => {
    expect(scan(/[Ａ-Ｚａ-ｚ０-９]/g)).toEqual([]);
  });

  it("許可した例外が実在する(消えたファイルの許可を残さない)", () => {
    const gone = Object.keys(ALLOWED).filter((f) => !fs.existsSync(path.join(process.cwd(), f)));
    expect(gone).toEqual([]);
  });

  it("許可した例外が、実際に外国語を含んでいる(不要な許可を溜めない)", () => {
    const idle = Object.keys(ALLOWED).filter((f) => {
      const t = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      return !/[Ѐ-ӿＡ-Ｚａ-ｚ０-９]/.test(t);
    });
    expect(idle).toEqual([]);
  });
});
