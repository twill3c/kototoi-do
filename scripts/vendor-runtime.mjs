// ONNX Runtime の wasm を自分のオリジンへ複製する。
// 既定では CDN から取りに行くため、そのままだと閲覧時に外部へ通信する(SPEC N-02 違反)。
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'node_modules/onnxruntime-web/dist';
const OUT = 'public/kotodoi/ort';
/*
  単スレッド運用なので jsep(WebGPU)版は要らない。10.6 MB と 20.6 MB の差は大きい。
  ただし Transformers.js の既定は onnxruntime-web の "all" 束で、これは jsep を取りに行く。
  next.config.ts で "onnxruntime-web/wasm" に寄せてある —— 寄せ替えが効かなくなったときに
  黙って外へ取りに行かせないよう、jsep 版も置いておく(SPEC N-02)。
*/
const FILES = [
  'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs',
];

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const f of FILES) {
  const src = path.join(SRC, f);
  if (!fs.existsSync(src)) throw new Error(`${src} が無い — onnxruntime-web の版で名前が変わった可能性`);
  fs.copyFileSync(src, path.join(OUT, f));
  const n = fs.statSync(src).size;
  total += n;
  console.log(`  ${f}  ${(n / 1048576).toFixed(1)} MB`);
}
console.log(`実行系 → ${OUT}  計 ${(total / 1048576).toFixed(1)} MB`);
