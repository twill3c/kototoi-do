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
  // Content-Type も見る。wasm が application/wasm で来ないと
  // WebAssembly.instantiateStreaming が使えず、読み取り機が動かない。
  { path: '/kotodoi/meta.json', kind: 'bin', mime: 'application/json' },
  { path: '/kotodoi/vec.i8', kind: 'bin', mime: 'application/octet-stream' },
  { path: '/kotodoi/own.u16', kind: 'bin', mime: 'application/octet-stream' },
  { path: '/kotodoi/s/0.json', kind: 'bin', mime: 'application/json' },
  { path: '/kotodoi/model/onnx/model_quantized.onnx', kind: 'bin', mime: 'application/octet-stream' },
  { path: '/kotodoi/model/tokenizer.json', kind: 'bin', mime: 'application/json' },
  { path: '/kotodoi/ort/ort-wasm-simd-threaded.wasm', kind: 'bin', mime: 'application/wasm' },
];

let bad = 0;
for (const c of CHECKS) {
  const url = BASE + c.path;
  try {
    /*
      HEAD を使わない —— Vercel は HEAD 応答に content-length を付けず、
      「0 バイト」に見えて正しいデプロイを不合格にする(loop_001 で踏んだ)。
      大きな資産は範囲つき GET で頭だけ取って、実際に届くことを確かめる。
    */
    const r = await fetch(url, c.kind === 'text' ? {} : { headers: { Range: 'bytes=0-65535' } });
    if (!r.ok && r.status !== 206) { console.log(`  ✗ ${c.path} → ${r.status}`); bad++; continue; }
    if (c.kind === 'text') {
      const t = await r.text();
      if (!t.includes(c.want)) { console.log(`  ✗ ${c.path} に「${c.want}」が無い`); bad++; continue; }
      console.log(`  ✓ ${c.path}`);
    } else {
      const got = (await r.arrayBuffer()).byteLength;
      if (got < 1000) { console.log(`  ✗ ${c.path} が ${got} バイトしか返らない`); bad++; continue; }
      const type = r.headers.get('content-type') ?? '';
      if (c.mime && !type.startsWith(c.mime)) {
        console.log(`  ✗ ${c.path} の Content-Type が ${type}(期待 ${c.mime})`); bad++; continue;
      }
      const total = r.headers.get('content-range')?.split('/')[1];
      console.log(`  ✓ ${c.path}  ${total ? (Number(total) / 1048576).toFixed(1) + ' MB' : got + ' バイト以上'}  ${type}`);
    }
  } catch (e) {
    console.log(`  ✗ ${c.path} → ${e.message}`); bad++;
  }
}
console.log(bad === 0 ? '\n本番反映 確認' : `\n本番反映 未確認(${bad} 件)`);
process.exit(bad === 0 ? 0 : 1);
