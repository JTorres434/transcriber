// POST /api/transcribe-cloud
// Body: { blobUrl: string, language?: string, task?: "transcribe"|"translate" }
// Auth: Bearer <clerk_session_jwt>
// Free tier: 10 minutes of audio per day (resets midnight Eastern Time)
// Pro: unlimited
import { del } from "@vercel/blob";
import {
  verifyClerkSession,
  getUserProState,
  cloudSecondsToday,
  addCloudSeconds,
  isLimitedHost,
  json,
  readJsonBody,
} from "./_lib.js";

const FREE_TIER_SECONDS = 10 * 60; // 10 minutes per day
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

  // Pull entitlement state. Non-public hosts (Vercel preview URLs, localhost)
  // bypass the quota entirely so JC can use the app for personal work.
  const state = await getUserProState(userId);
  const effectivePro = state.pro || !isLimitedHost(req);
  const usedSeconds = cloudSecondsToday(state);
  if (!effectivePro && usedSeconds >= FREE_TIER_SECONDS) {
    await safeDelete(blobUrl);
    return json(res, 402, {
      error: "Free cloud minutes exhausted",
      used: usedSeconds,
      limit: FREE_TIER_SECONDS,
      upgradeRequired: true,
    });
  }

  // Honest-client duration pre-check: if the client tells us how long the
  // file is and it would push them over, reject before burning a Groq call.
  // (A lying client still gets caught by the post-charge below; their
  // *next* request will be blocked by the check above.)
  const claimedDuration = Number(body.durationSec) || 0;
  if (!effectivePro && claimedDuration > 0 && usedSeconds + claimedDuration > FREE_TIER_SECONDS) {
    await safeDelete(blobUrl);
    return json(res, 402, {
      error: "File would exceed free tier",
      used: usedSeconds,
      limit: FREE_TIER_SECONDS,
      requested: claimedDuration,
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
  // Groq picks the language code from this param. Their translations
  // endpoint always outputs English regardless of language hint.
  if (body.language) form.append("language", body.language);

  // Transcribe vs translate is determined by the endpoint URL, not a param.
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
    // Groq's Whisper endpoint caps each request at 25 MB. The client compresses
    // to mono 32 kbps MP3 before upload, so this should rarely trigger — but
    // give a clean message in case decoding fell back to the original file.
    if (groqRes.status === 413 || /request_too_large|Request Entity Too Large/i.test(text)) {
      return json(res, 413, {
        error: "This file is too large for cloud transcription. Try Local Fast mode for files this big.",
      });
    }
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
  // Unlimited-host users skip counting so their usage doesn't accumulate
  // against the limited torrolabs.com persona of the same Clerk account.
  let usageAfter = null;
  if (!effectivePro && durationSec > 0) {
    try { usageAfter = await addCloudSeconds(userId, Math.ceil(durationSec)); }
    catch (_) {}
  }

  return json(res, 200, {
    text: result.text || "",
    chunks,
    duration: durationSec,
    language: result.language || null,
    pro: effectivePro,
    usage: effectivePro ? null : {
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
