import Kotodoi from "@/components/Kotodoi";
import { SHOP } from "@/data/shop";
import Noren from "@/components/Noren";

export default function Home() {
  return (
    <div className="wrap">
      <Noren />
      <h1>{SHOP.name}</h1>
      <p className="lead">
        {SHOP.address}。{SHOP.founded}より、この橋のたもとで店をひらいています。
      </p>
      <p>
        当店には検索台がありません。かわりに、探しものを<strong>言葉で問うて</strong>いただきます。
        書名を覚えていなくてよろしい。「雨の日に読みたい」「親子の別れ」— その程度で結構です。
        本文を読んで、近いものを棚から出してまいります。
      </p>

      <Kotodoi />

      <h2>この店のしくみ</h2>
      <p>
        棚に並べてあるのは、青空文庫で公開されている作品です。当店はその<strong>本文</strong>だけを読んで
        覚えております。書名も著者名も、覚えるほうには入れておりません。
        書名で引けるなら意味で引く必要がないので、そういう作りにしました。
      </p>
      <p>
        読み取りは、すべてお客さまのお手元で行われます。問いは当店にも、どこの誰にも送られません。
        通信いたしますのは、最初に索引と読み取り機をお渡しするときだけです。
        <span className="note">
          （つまり、この店には受け答えをする機械が置かれておりません。置く必要がなかったのです。）
        </span>
      </p>
    </div>
  );
}
