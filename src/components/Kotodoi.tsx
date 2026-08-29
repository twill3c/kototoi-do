"use client";

import { useCallback, useRef, useState } from "react";
import { aozoraUrl, loadIndex, loadSnippets, search, type Hit, type Index } from "@/lib/kotodoi";
import payload from "@/data/payload.json";

const EXAMPLES = [
  "雨の日に読みたい",
  "海と船が出てくる話",
  "親子の別れ",
  "都会でひとり暮らす",
  "山を歩く",
  "食べものの話",
];

type Phase = "idle" | "loading" | "ready" | "searching" | "error";

export default function Kotodoi() {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [snips, setSnips] = useState<Map<number, string[]>>(new Map());
  const [asked, setAsked] = useState("");
  const idxRef = useRef<Index | null>(null);
  const encRef = useRef<((t: string) => Promise<Float32Array>) | null>(null);

  const prepare = useCallback(async () => {
    if (idxRef.current && encRef.current) return;
    setPhase("loading");
    // 索引と読み取り機は、最初に問われたときに初めて取りに行く(SPEC F-06)。
    // 棚を見に来ただけの人に 一式を背負わせない。
    const [idx, enc] = await Promise.all([
      loadIndex((f, l) => { setProgress(f * 0.4); setLabel(l); }),
      import("@/lib/encoder").then((m) =>
        m.createEncoder((f, l) => { setProgress(0.4 + f * 0.6); setLabel(l); }),
      ),
    ]);
    idxRef.current = idx;
    encRef.current = enc;
    setPhase("ready");
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      try {
        await prepare();
        setPhase("searching");
        setAsked(t);
        const qv = await encRef.current!(t);
        const idx = idxRef.current!;
        const h = search(idx, qv, 12);
        setHits(h);
        setSnips(await loadSnippets(idx, h));
        setPhase("ready");
      } catch (e) {
        console.error(e);
        setLabel(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [prepare],
  );

  const busy = phase === "loading" || phase === "searching";
  const idx = idxRef.current;

  return (
    <section className="kotodoi" aria-labelledby="kotodoi-h">
      <h2 id="kotodoi-h">言問い</h2>
      <p className="lead">
        探している気分や場面を、そのまま言葉で書いてください。書名でなくて構いません。
        本文の意味が近い順に、棚から出してきます。
      </p>
      <p className="note">
        よく出るのは<strong>目に見えるもの</strong>を挙げた問いです —— 山、船、楽器、幽霊、食べもの。
        「恋に破れる」「老いてゆく」のような<strong>心の在りよう</strong>は苦手にしております。
        そういう話は、書かれているのに「恋」とも「老い」とも書いていないことが多いためです。
        当店で実際に測った数字は<a href="/aruji/">店主</a>のところに出しております。
      </p>

      <form
        className="kotodoi__form"
        onSubmit={(e) => { e.preventDefault(); void ask(q); }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="たとえば — 雨の日に読みたい"
          aria-label="探している気分や場面"
          disabled={busy}
        />
        <button type="submit" disabled={busy}>{busy ? "…" : "問う"}</button>
      </form>

      <p className="kotodoi__examples">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" disabled={busy} onClick={() => { setQ(e); void ask(e); }}>
            {e}
          </button>
        ))}
      </p>

      {phase === "idle" && (
        <p className="note">
          この検索は、あなたの端末の中だけで動きます。問いはどこにも送られず、店にも残りません。
          そのかわり、<strong>最初の一問のときだけ</strong>、蔵書の索引 {payload.index} MB と
          読み取り機 {payload.model} MB、それを動かす仕掛け {payload.runtime} MB
          —— あわせて <strong>{payload.total} MB</strong> をお渡しします。
          二問目からあとは、お見せする十冊の抜き書きだけ(一問につき数百 KB)。
          棚を見るだけの方には一切お渡ししません。
        </p>
      )}

      {(phase === "loading" || phase === "searching") && (
        <div className="kotodoi__status" role="status">
          {label || "棚を探しています"}
          <div className="kotodoi__bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          {phase === "loading" && (
            <p className="note" style={{ margin: "0.5rem 0 0" }}>
              全部で {payload.total} MB。お待たせするのはこの一度きりです。
            </p>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="kotodoi__status" role="alert">
          うまく取り出せませんでした。<span className="note">{label}</span>
        </div>
      )}

      {hits && idx && phase !== "loading" && (
        <>
          <h3>「{asked}」に近い蔵書</h3>
          <p className="note">
            近い順に並べています。順位だけを出し、点数は出しません —
            この模型の点数は狭い範囲に固まり、大小の差が読み手にとっての差と一致しないためです。
          </p>
          <ol className="hits">
            {hits.map((h, i) => {
              const w = idx.meta.works[h.work];
              const url = aozoraUrl(w);
              const text = snips.get(h.work)?.[h.chunkInWork];
              return (
                <li className="hit" key={w[0]}>
                  <div className="hit__rank">{i + 1}</div>
                  <div>
                    <p className="hit__title">{w[1]}</p>
                    <p className="hit__by">{w[2]}{w[3] ? ` ・ ${w[3]}` : ""} ・ 約 {w[4].toLocaleString("ja-JP")} 字</p>
                    {text && (
                      <blockquote className="hit__snip">
                        {text.slice(0, 150)}…
                        <cite>本文 {h.chunkInWork + 1} 本目の抜き取り箇所より</cite>
                      </blockquote>
                    )}
                    <p className="hit__links">
                      {url ? <a href={url} target="_blank" rel="noopener noreferrer">青空文庫の図書カード</a> : <span className="note">図書カード未詳</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
