// POST /api/transcribe-cloud
// Body: { blobUrl: string, language?: string, task?: "transcribe"|"translate" }
// Auth: Bearer <clerk_session_jwt>
// Free tier: 30 minutes of audio per month
// Pro: unlimited
import { del } from "@vercel/blob";
import {
  verifyClerkSession,
  getUserProState,
  cloudSecondsThisMonth,
  addCloudSeconds,
  json,
  readJsonBody,
} from "./_lib.js";

const FREE_TIER_SECONDS = 30 * 60; // 30 minutes
const GROQ_MODEL = "whisper-large-v3-turbo";

export const config = {
  api: { bodyParser: { sizeLimit: "4.5mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const userId = await verifyClerkSession(req);
  if (!userId) return json(res, 401, { error: "Sign in required" });

  let body;
  try { body = await readJsonBody(req); }
  catch { return json(res, 400, { error: "Invalid JSON" }); }

  const blobUrl = body.blobUrl;
  if (!blobUrl) return json(res, 400, { error: "Missing blobUrl" });

  // Pull entitlement state. We do an "optimistic" pre-check so blatantly
  // over-quota users don't even start an upload-to-Groq.
  const state = await getUserProState(userId);
  const usedSeconds = cloudSecondsThisMonth(state);
  if (!state.pro && usedSeconds >= FREE_TIER_SECONDS) {
    await safeDelete(blobUrl);
    return json(res, 402, {
      error: "Free cloud minutes exhausted",
      used: usedSeconds,
      limit: FREE_TIER_SECONDS,
      upgradeRequired: true,
    });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    await safeDelete(blobUrl);
    return json(res, 500, { error: "Server not configured" });
  }

  // Fetch the audio from Vercel Blob, then forward to Groq.
  let audioResp;
  try {
    audioResp = await fetch(blobUrl);
    if (!audioResp.ok) throw new Error("Bad blob");
  } catch (e) {
    await safeDelete(blobUrl);
    return json(res, 502, { error: "Couldn't fetch uploaded audio" });
  }
  const audioBlob = await audioResp.blob();

  // Groq requires a file extension it recognizes. Derive from blob URL,
  // then sanity-check against the allowed list.
  const filename = pickGroqFilename(blobUrl, body.filename);

  const form = new FormData();
  form.append("file", audioBlob, filename);
  form.append("model", GROQ_MODEL);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (body.language) form.append("language", body.language);
  if (body.task === "translate") {
    // Groq uses a separate endpoint for translations.
    // Fall through to the translation flow below.
  } else {
    form.append("task", "transcribe");
  }

  const endpoint = body.task === "translate"
    ? "https://api.groq.com/openai/v1/audio/translations"
    : "https://api.groq.com/openai/v1/audio/transcriptions";

  let groqRes;
  try {
    groqRes = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
  } catch (e) {
    await safeDelete(blobUrl);
    return json(res, 502, { error: "Transcription service unreachable" });
  }

  if (!groqRes.ok) {
    const text = await groqRes.text().catch(() => "");
    await safeDelete(blobUrl);
    return json(res, 502, {
      error: "Transcription failed",
      detail: text.slice(0, 400),
    });
  }

  const result = await groqRes.json();
  // Clean up the blob; we don't keep audio after transcription.
  await safeDelete(blobUrl);

  // Normalize Groq's output to the same shape the worker emits so the
  // frontend can render with the existing code paths.
  const chunks = (result.segments || []).map(s => ({
    text: " " + (s.text || "").trim(),
    timestamp: [s.start || 0, s.end || (s.start || 0) + 2],
  }));
  const durationSec = Number(result.duration || 0);

  // Update usage AFTER successful transcription so failures don't count.
  let usageAfter = null;
  if (!state.pro && durationSec > 0) {
    try { usageAfter = await addCloudSeconds(userId, Math.ceil(durationSec)); }
    catch (_) {}
  }

  return json(res, 200, {
    text: result.text || "",
    chunks,
    duration: durationSec,
    language: result.language || null,
    pro: state.pro,
    usage: state.pro ? null : {
      used: usageAfter ?? usedSeconds,
      limit: FREE_TIER_SECONDS,
    },
  });
}

async function safeDelete(blobUrl) {
  try { await del(blobUrl); } catch (_) {}
}

const GROQ_VALID_EXTS = ["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"];

function pickGroqFilename(blobUrl, clientFilename) {
  const candidates = [clientFilename, blobUrl.split("?")[0].split("/").pop()];
  for (const name of candidates) {
    if (!name) continue;
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (GROQ_VALID_EXTS.includes(ext)) return name;
  }
  // Common defaults: mp4 if it looks like a video URL, mp3 otherwise
  const looksLikeVideo = /\.(mov|avi|mkv|m4v)$/i.test(blobUrl);
  return looksLikeVideo ? "audio.mp4" : "audio.mp3";
}
