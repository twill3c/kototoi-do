import type { Metadata } from "next";
import { SHOP } from "@/data/shop";
import { FOOTER, SITE } from "@/data/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: { default: `${SHOP.name} — ${SHOP.tagline}`, template: `%s — ${SHOP.name}` },
  description:
    "向島・言問橋のたもとにある架空の古書店。「雨の日に読みたい」のような言葉で、青空文庫の蔵書を本文の意味から引きます。検索はすべて閲覧者の端末の中で動き、問いはどこにも送られません。",
};

const NAV = [
  { href: "/", label: "言問い" },
  { href: "/tana/", label: "棚" },
  { href: "/aruji/", label: "店主" },
  { href: "/annai/", label: "ご案内" },
  { href: "/oshirase/", label: "お知らせ" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="masthead">
          <div className="wrap">
            <a className="masthead__name" href="/">{SHOP.name}</a>
            <span className="masthead__reading">{SHOP.reading}</span>
            <nav aria-label="店内の案内">
              {NAV.map((i) => <a key={i.href} href={i.href}>{i.label}</a>)}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/*
          架空の店に LocalBusiness の構造化データを出さない。
          番地を書かなくても、型そのものが「ここに店がある」と主張してしまう。
          ブランドサイト三作(senoto-mori / hoshihata / sugi-nami)と同じ扱いにする。

          fleet: fixed footer。共通規約の 5 項目・この並び・下部固定。
          架空である旨はその下に一行として置く。
        */}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <a href={FOOTER.license}>MIT License</a>
            <span className="site-footer__copy">© 2026 坂田哲朗</span>
            <span className="fsep">・</span><a href={FOOTER.repository}>GitHub</a>
            <span className="fsep">・</span><a href={FOOTER.guide}>言問堂の歩き方</a>
            <span className="fsep">・</span><a href={FOOTER.blueprint}>言問堂の設計図</a>
            <span className="fsep">・</span><a href={FOOTER.appMenu}>App Menu</a>
            <p className="site-footer__fiction">{SHOP.fictionNotice}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
