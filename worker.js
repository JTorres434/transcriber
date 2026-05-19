// Web Worker — runs Whisper without freezing the UI.
// Posts phase + live-text updates so the UI can show real progress.

self.postMessage({ type: "worker_alive" });

const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

let _libPromise = null;
async function getLib() {
  if (!_libPromise) {
    _libPromise = (async () => {
      self.postMessage({ type: "phase", phase: "lib_loading" });
      const mod = await import(TRANSFORMERS_URL);
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      self.postMessage({ type: "phase", phase: "lib_loaded" });
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
  self.postMessage({ type: "phase", phase: "detect_device" });
  if (!("gpu" in navigator)) {
    detectedDevice = "wasm";
    return detectedDevice;
  }
  try {
    const adapter = await Promise.race([
      navigator.gpu.requestAdapter(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("WebGPU timeout")), 3000)
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
  self.postMessage({ type: "phase", phase: "model_loading", modelId });

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

  self.postMessage({ type: "phase", phase: "model_ready", modelId });
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
      await getLib();
      const device = await detectDevice();
      self.postMessage({ type: "device", device, cached: false });
      return;
    }

    if (msg.type === "preload") {
      await loadPipeline(msg.modelId);
      self.postMessage({ type: "preload_done", modelId: msg.modelId });
      return;
    }

    if (msg.type === "transcribe") {
      cancelToken = { cancelled: false };
      const token = cancelToken;

      const pipe = await loadPipeline(msg.modelId);
      if (token.cancelled) throw new Error("Cancelled");

      const totalSeconds = msg.audio.length / 16000;
      self.postMessage({ type: "transcribe_start", totalSeconds });

      // Throttled live-text updates — at most every 200ms. transformers.js v3
      // calls callback_function on every generation step with the cumulative
      // decoded text in item[0].output_text. We use this for both liveness
      // (UI shows text growing) and cancellation.
      let lastUpdate = 0;
      const callback_function = (item) => {
        if (token.cancelled) throw new Error("Cancelled");
        const now = Date.now();
        if (now - lastUpdate < 200) return;
        lastUpdate = now;
        const last = Array.isArray(item) ? item[0] : item;
        if (last && (last.output_text || last.text)) {
          self.postMessage({
            type: "live_text",
            text: last.output_text || last.text || "",
            tps: last.tps || null,
          });
        }
      };

      const result = await pipe(msg.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: msg.lang || null,
        task: "transcribe",
        no_repeat_ngram_size: 3,
        force_full_sequences: false,
        callback_function,
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
