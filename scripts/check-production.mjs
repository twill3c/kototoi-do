/*
  本番に反映されたかを、本番 URL を実際に引いて判定する。
  `vercel ls` の Age 列は実際と大きくずれることがあり、状態のポーリングに使えない。
*/
const BASE = process.argv[2] ?? 'https://kototoi-do.vercel.app';
const CHECKS = [
  { path: '/', want: '言問堂', kind: 'text' },
  { path: '/tana/', want: '分類の棚', kind: 'text' },
  { path: '/aruji/', want: '名にし負はば', kind: 'text' },
  { path: '/annai/', want: '架空の古書店', kind: 'text' },
  { path: '/oshirase/', want: '言問いの窓', kind: 'text' },
  { path: '/kotodoi/meta.json', want: null, kind: 'json' },
  { path: '/kotodoi/vec.i8', want: null, kind: 'bin' },
  { path: '/kotodoi/model/onnx/model_quantized.onnx', want: null, kind: 'bin' },
  { path: '/kotodoi/ort/ort-wasm-simd-threaded.wasm', want: null, kind: 'bin' },
];

let bad = 0;
for (const c of CHECKS) {
  const url = BASE + c.path;
  try {
    const r = await fetch(url, { method: c.kind === 'text' ? 'GET' : 'HEAD' });
    if (!r.ok) { console.log(`  ✗ ${c.path} → ${r.status}`); bad++; continue; }
    if (c.kind === 'text') {
      const t = await r.text();
      if (!t.includes(c.want)) { console.log(`  ✗ ${c.path} に「${c.want}」が無い`); bad++; continue; }
      console.log(`  ✓ ${c.path}`);
    } else {
      const len = Number(r.headers.get('content-length') ?? 0);
      if (len < 1000) { console.log(`  ✗ ${c.path} が ${len} バイト`); bad++; continue; }
      console.log(`  ✓ ${c.path}  ${(len / 1048576).toFixed(1)} MB`);
    }
  } catch (e) {
    console.log(`  ✗ ${c.path} → ${e.message}`); bad++;
  }
}
console.log(bad === 0 ? '\n本番反映 確認' : `\n本番反映 未確認(${bad} 件)`);
process.exit(bad === 0 ? 0 : 1);
