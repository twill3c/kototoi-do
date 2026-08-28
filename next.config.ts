import type { NextConfig } from "next";
import path from "node:path";

// 静的書き出しのみ。サーバ関数を一つも持たない(SPEC N-01)。
// 言問いの索引はビルド前にローカルで焼き、public/ から同一オリジンで配る(N-02/N-04)。
// next build は索引生成器を呼ばない — 呼べば Vercel 上でモデルを落としに行くことになる。
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  /*
    onnxruntime-web の既定の束は WebGPU 込みの jsep 版で、wasm が 20.6 MB ある。
    この店は一問ごとに短い列を一本通すだけなので WebGPU は要らない。
    wasm 専用の束へ寄せると 10.6 MB になる。

    "onnxruntime-web-use-extern-wasm" は、wasm を JS に base64 で埋め込まず
    別ファイルとして置くための書き出し条件。これを立てないと束の中に抱き込まれ、
    かえって大きくなる。
  */
  webpack: (config, { isServer }) => {
    // 閲覧側の束だけを差し替える。サーバ側に混ぜると Node 版の実行系を掴んでしまう。
    if (!isServer) {
      // 書き出し条件(onnxruntime-web-use-extern-wasm)を立てる代わりに、
      // 目当てのファイルを名指しする。条件名の配列に手を入れると "node" が
      // 紛れ込んで Node 版の transformers を掴むことがある(loop_001 で踏んだ)。
      // exports フィールドが深いパスを塞ぐので、ファイルの実体を絶対パスで指す
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-web$": path.resolve("node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"),
      };
    }
    return config;
  },
};

export default nextConfig;
