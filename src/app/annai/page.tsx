import type { Metadata } from "next";
import { SHOP } from "@/data/shop";

export const metadata: Metadata = { title: "ご案内" };

export default function Annai() {
  return (
    <div className="wrap">
      <h1>ご案内</h1>
      <div className="scroller">
        <table>
          <tbody>
            <tr><th>屋号</th><td>{SHOP.name}（{SHOP.reading}）</td></tr>
            <tr><th>所在</th><td>{SHOP.address}</td></tr>
            <tr><th>開店</th><td>{SHOP.founded}</td></tr>
            <tr><th>営業</th><td>{SHOP.hours}</td></tr>
            <tr><th>休み</th><td>{SHOP.closed}</td></tr>
            <tr><th>取扱</th><td>近代文学・随筆・紀行・翻訳もの</td></tr>
          </tbody>
        </table>
      </div>

      <h2>道のり</h2>
      <p>
        言問橋の東詰から墨堤通りを北へ。牛嶋神社の裏手をまわると、川に背を向けた低い軒があります。
        暖簾が出ていれば開いております。
      </p>

      <h2>買取</h2>
      <p>
        全集の端本、函の傷んだもの、書き込みのあるものも拝見します。
        署名や蔵書票のあるものは、その来歴ごとお持ちください。
      </p>

      <h2>お断り</h2>
      <p className="note">
        {SHOP.fictionNotice}
        この住所に店舗はなく、買取も通信販売も行っておりません。
        当サイトは、静的なウェブサイトだけで意味検索を成立させられるかを確かめるために作った
        ポートフォリオです。
      </p>
    </div>
  );
}
