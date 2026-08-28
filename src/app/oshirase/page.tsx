import type { Metadata } from "next";

export const metadata: Metadata = { title: "お知らせ" };

const NEWS = [
  {
    date: "2026-08-29",
    title: "言問いの窓をひらきました",
    body:
      "本文の意味から蔵書を引く窓を店先に出しました。書名を覚えていなくても構いません。" +
      "問いはお手元の機械の中だけで処理され、当店には届きません。",
  },
  {
    date: "2026-08-29",
    title: "棚を組みなおしました",
    body:
      "青空文庫で公開されている作品を、本文だけを読んで並べなおしました。" +
      "書名と著者名は棚組みに使っておりません。",
  },
];

export default function Oshirase() {
  return (
    <div className="wrap">
      <h1>お知らせ</h1>
      {NEWS.map((n) => (
        <article key={n.date + n.title}>
          <h2>{n.title}</h2>
          <p className="note">{n.date}</p>
          <p>{n.body}</p>
        </article>
      ))}
    </div>
  );
}
