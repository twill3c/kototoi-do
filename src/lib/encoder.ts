/*
  問い合わせ文をベクトルに直す。閲覧者の端末で動く(SPEC N-01/N-02)。

  索引は刈る前の模型で作ってあるが、ここで使うのは語彙を刈った模型である。
  日本語について両者が同じベクトルを出すことは G-06 で検算してある
  (`node scripts/verify-prune.mjs`)。
*/

export type Encoder = (text: string) => Promise<Float32Array>;

export async function createEncoder(
  onProgress?: (frac: number, label: string) => void,
): Promise<Encoder> {
  onProgress?.(0.05, "読み取り機を受け取っています");
  const { pipeline, env } = await import("@huggingface/transformers");

  // 外から取りに行く経路を閉じる。模型も実行系も同じオリジンから配る。
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = "/kotodoi/";
  const wasm = env.backends.onnx.wasm;
  if (!wasm) throw new Error("ONNX Runtime の wasm 設定が見当たらない");
  wasm.wasmPaths = "/kotodoi/ort/";
  // 複数スレッドは SharedArrayBuffer を要求し、そのために COOP/COEP を立てることになる。
  // 一問ごとの短い列を一本通すだけなので、単スレッドで足りる。
  wasm.numThreads = 1;

  const extractor = await pipeline("feature-extraction", "model", {
    dtype: "q8",
    progress_callback: (p: { status?: string; progress?: number }) => {
      if (p.status === "progress" && typeof p.progress === "number") {
        onProgress?.(0.05 + (p.progress / 100) * 0.9, "読み取り機を受け取っています");
      }
    },
  });
  onProgress?.(1, "支度ができました");

  return async (text: string) => {
    // e5 は接頭辞を要求する。索引側は passage:、問い合わせ側は query:。
    // ここを外すと索引と別の空間を向く。
    const out = await extractor("query: " + text, { pooling: "mean", normalize: true });
    return Float32Array.from(out.data as Float32Array);
  };
}
