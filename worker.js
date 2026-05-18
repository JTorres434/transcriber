// Heavy lifting runs here in a Web Worker so the UI stays responsive.
// Auto-detects WebGPU (fast) and falls back to WASM (CPU).

// Tell the main thread the worker file actually loaded and is running.
self.postMessage({ type: "worker_alive" });

const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

let _libPromise = null;
async function getLib() {
  if (!_libPromise) {
    _libPromise = (async () => {
      self.postMessage({ type: "lib_loading" });
      const mod = await import(TRANSFORMERS_URL);
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      self.postMessage({ type: "lib_loaded" });
      return mod;
    })().catch((err) => {
      _libPromise = null;
      throw new Error("Failed to load transformers.js: " + (err.message || err));
    });
  }
  return _libPromise;
}

const cachedPipelines = new Map();
let cancelToken = { cancelled: false };
let detectedDevice = null;

async function detectDevice() {
  if (detectedDevice) return detectedDevice;
  if (!("gpu" in navigator)) {
    detectedDevice = "wasm";
    return detectedDevice;
  }
  try {
    const adapter = await Promise.race([
      navigator.gpu.requestAdapter(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("WebGPU detection timed out")), 3000)
      ),
    ]);
    detectedDevice = adapter ? "webgpu" : "wasm";
  } catch (_) {
    detectedDevice = "wasm";
  }
  return detectedDevice;
}

async function loadPipeline(modelId) {
  const { pipeline } = await getLib();
  const device = await detectDevice();
  const cacheKey = modelId + "::" + device;
  if (cachedPipelines.has(cacheKey)) {
    self.postMessage({ type: "device", device, cached: true });
    return cachedPipelines.get(cacheKey);
  }
  self.postMessage({ type: "device", device, cached: false });

  let dtype;
  if (device === "webgpu") {
    dtype = modelId.includes("large-v3-turbo")
      ? { encoder_model: "fp32", decoder_model_merged: "q4" }
      : "fp32";
  } else {
    dtype = "q8";
  }

  const pipe = await pipeline("automatic-speech-recognition", modelId, {
    dtype,
    device,
    progress_callback: (data) => {
      self.postMessage({ type: "load_progress", data });
    },
  });

  cachedPipelines.set(cacheKey, pipe);
  return pipe;
}

self.onmessage = async (e) => {
  const msg = e.data;

  try {
    if (msg.type === "cancel") {
      cancelToken.cancelled = true;
      return;
    }

    if (msg.type === "warmup") {
      // Load the library (so first real run is faster) and detect device.
      await getLib();
      const device = await detectDevice();
      self.postMessage({ type: "device", device, cached: false });
      return;
    }

    if (msg.type === "transcribe") {
      cancelToken = { cancelled: false };
      const token = cancelToken;

      const pipe = await loadPipeline(msg.modelId);
      if (token.cancelled) throw new Error("Cancelled");

      const totalSeconds = msg.audio.length / 16000;
      self.postMessage({ type: "transcribe_start", totalSeconds });

      const result = await pipe(msg.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: msg.lang || null,
        task: "transcribe",
        no_repeat_ngram_size: 3,
        chunk_callback: (chunk) => {
          if (token.cancelled) throw new Error("Cancelled");
          if (chunk?.timestamp?.[1] != null) {
            self.postMessage({
              type: "chunk_progress",
              elapsed: chunk.timestamp[1],
            });
          }
        },
        callback_function: () => {
          if (token.cancelled) throw new Error("Cancelled");
        },
      });

      self.postMessage({ type: "done", result });
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    self.postMessage({ type: "error", message, stage: msg && msg.type });
  }
};

self.onerror = (e) => {
  self.postMessage({ type: "error", message: e.message || String(e), stage: "worker" });
};
