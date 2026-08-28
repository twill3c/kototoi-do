# 言問堂 — kototoi-do

東京・向島、言問橋のたもとにある**架空の古書店**のブランドサイト。
ポートフォリオであり、実在の店舗ではない。

本番: https://kototoi-do.vercel.app

## 何を試している店か

検索窓が飾りでない。「雨の日に読みたい」のような自然文を受け、
青空文庫 5,000 作の**本文**から蔵書を引く。書名の一致では引かない。

そのうえで、**課金される経路が構造として存在しない**ように作ってある。

- サーバ関数を一つも持たない(`output: "export"` の静的書き出しのみ)
- 埋め込みはビルド前にローカルで一度だけ計算し、配布物に焼き込む
- 閲覧時の計算はすべて閲覧者の端末で行われる。問いはどこへも送られない
- API キーが要る箇所が無い

「無料枠に収める」のではなく、**無料枠を使う場所を作らなかった**という作り。

## 棚の組み方

索引に入れるのは**本文だけ**である。書名も著者名も入れていない。
これは意匠ではなく、あとで棚の出来を測るための条件になっている。

書名を覚えさせていない索引に「海」と問い、海の字を持つ作品が上位に集まるなら、
その索引は本文を読めていることになる。埋め込みで引いた結果を埋め込みで採点しては
何も分からない(**循環の禁止**)。

較正の結果と、測って捨てた工夫は [docs/CALIBRATION.md](docs/CALIBRATION.md) にある。

## 作り直す手順

索引は生成物だが、**Vercel のビルド中には作らない**。模型を落としに行くことになるため。
ローカルで焼いて、成果物をリポジトリに置く。

```bash
npm install
node scripts/fetch-model.mjs          # 模型の原本を data/model-src へ(1 回だけ)
npm run embed -- --chunks 8           # 本文の埋め込み。全件で 30〜80 分
npm run pack  -- --chunks 4           # 配布物 public/kotodoi/ へ梱包
npm test                              # 単体 + 配布物の検め
npm run build                         # 静的書き出し
```

較正だけをやり直すとき:

```bash
npm run embed -- --limit 1500 --stride 3 --chunks 8 --out data/calib
npm run calibrate data/calib
```

## 出どころ

- 本文・目録: [青空文庫](https://www.aozora.gr.jp/)(正規化済みのものを `aozora-sakuin` から借りている)
- 埋め込み模型: [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small)(Xenova の ONNX 版)

## ライセンス

MIT License © 2026 坂田哲朗
