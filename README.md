# Transcriber

Drop any audio or video file, get a clean transcript with timestamps. Runs
100% in the user's browser via [Transformers.js](https://huggingface.co/docs/transformers.js)
and Whisper — no API keys, no server-side compute, no cost.

Files never leave the user's computer.

---

## Stack

- Plain HTML + ES modules. No build step.
- [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers) v3 loaded from CDN.
- Whisper inference in a Web Worker (UI stays responsive).
- WebGPU when available, WASM fallback.

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI + main thread |
| `worker.js` | Heavy lifting (model load + transcription) |
| `favicon.svg` | App icon |
| `vercel.json` | Cache headers for Vercel |
| `serve.py` | Local dev server (Python stdlib only) |
| `run.bat` | Windows: double-click to launch locally |

---

## Local development

You need any Python 3 installed (works with 3.10+, including 3.14).

**Windows:** double-click `run.bat`. The app opens in your browser at
`http://localhost:8000`.

**Anywhere:**
```bash
python serve.py
```

Then open the printed URL.

---

## Deploying to Vercel

This is a pure static site. No build step, no server functions, no env vars.

### Option A — GitHub + Vercel dashboard (easiest)

1. Push this folder to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/transcriber.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Leave **Framework Preset** as `Other`. Leave Build Command and Output
   Directory empty. Click Deploy.
4. Done. The app is live in ~10 seconds.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow prompts. For production:
```bash
vercel --prod
```

---

## How it works under the hood

1. User drops a file. Main thread decodes it with the browser's built-in
   `AudioContext` and resamples to 16 kHz mono float32 (what Whisper expects).
2. The PCM samples are transferred (zero-copy) into a Web Worker.
3. Worker checks for WebGPU. If available, uses it. Otherwise falls back to
   WASM (CPU).
4. Worker loads the chosen Whisper model from the Hugging Face CDN. First
   load is cached in the browser's IndexedDB — second run is instant.
5. Worker runs Whisper on the audio in 30-second chunks with a 5-second
   stride. Each chunk's progress is posted back to the main thread.
6. When done, the main thread renders the transcript and exposes
   .txt / .srt downloads.

## Models

| Option | Model | Size | Notes |
|--------|-------|------|-------|
| Fast | `Xenova/whisper-base` | ~150 MB | Default. Good for clear audio. |
| Accurate | `Xenova/whisper-small` | ~500 MB | Catches more, slower. |
| Best | `onnx-community/whisper-large-v3-turbo` | ~1.6 GB | Requires WebGPU for speed. |

Models are downloaded once from `huggingface.co` and cached in the user's
browser. The cache survives across sessions and across deployments (it's
keyed by model ID).

## Browser support

- **Chrome / Edge (recommended):** WebGPU enabled by default. Fastest.
- **Firefox:** WASM only. Slower but works.
- **Safari:** Works. WebGPU support varies by version.

Mobile browsers will technically run it, but expect slow performance and
high memory use for large files.
