import type { Metadata } from "next";
import shelf from "@/data/shelf.json";

export const metadata: Metadata = { title: "棚" };

export default function Tana() {
  const man = (n: number) => (n / 10000).toFixed(0);
  return (
    <div className="wrap">
      <h1>棚</h1>
      <p className="lead">
        蔵書 {shelf.total.toLocaleString("ja-JP")} 冊。著者 {shelf.authorTotal.toLocaleString("ja-JP")} 名。
        通してのべ {man(shelf.chars)} 万字ございます。
      </p>
      <p>
        言問いでうまく出てこないときは、こちらから辿ってください。
        分類は青空文庫の目録に付いている日本十進分類法の番号によるもので、当店が付けたものではありません。
      </p>

      <h2>分類の棚</h2>
      <ul className="shelf">
        {shelf.ndc.map((c) => (
          <li key={c.code}>
            <div className="shelf__label">{c.label}</div>
            <div className="shelf__count">{c.n.toLocaleString("ja-JP")} 冊{c.code !== "other" && ` ・ NDC ${c.code}`}</div>
          </li>
        ))}
      </ul>

      <h2>長さの棚</h2>
      <p className="note">
        一晩で読み切れるものを探しているときのために。字数は本文の字数で、ルビと注記は数えておりません。
      </p>
      <div className="scroller">
        <table>
          <thead><tr><th>棚</th><th>字数</th><th>冊数</th><th></th></tr></thead>
          <tbody>
            {shelf.lengths.map((b) => {
              const max = Math.max(...shelf.lengths.map((x) => x.n));
              return (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  {/* 上限なしの棚は JSON で null になる(Infinity は書けない) */}
                  <td className="note">
                    {b.lo.toLocaleString("ja-JP")} — {b.hi === null ? "" : b.hi.toLocaleString("ja-JP")} 字
                  </td>
                  <td>{b.n.toLocaleString("ja-JP")}</td>
                  <td style={{ width: "40%" }}>
                    <span style={{ display: "block", height: "0.5rem", background: "#8c3a3a", width: `${(b.n / max) * 100}%` }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>よくお預かりしている著者</h2>
      <ul className="shelf">
        {shelf.authors.map((a) => (
          <li key={a.name}>
            <div className="shelf__label">{a.name}</div>
            <div className="shelf__count">{a.n.toLocaleString("ja-JP")} 冊</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
