// POST /api/summarize
// Body: { transcript: string, durationSec: number }
// Auth: Bearer <clerk_session_jwt>
// Free tier: 2 summaries per month
// Pro: unlimited
import {
  verifyClerkSession,
  getUserProState,
  incrementSummaryCount,
  json,
  readJsonBody,
} from "./_lib.js";

const FREE_TIER_LIMIT = 2;

// Pulls the first {…} block out of a possibly-noisy LLM response.
// Handles cases where the model wraps JSON in markdown fences or adds prose.
function extractJsonObject(text) {
  if (!text) return null;
  // Try direct parse first
  try { return JSON.parse(text); } catch (_) {}
  // Strip markdown code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch (_) {}
  }
  // Find first { and matching final }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TRANSCRIPT_CHARS = 50000; // ~12-15k tokens, well within Groq context

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const userId = await verifyClerkSession(req);
  if (!userId) return json(res, 401, { error: "Sign in required" });

  let body;
  try { body = await readJsonBody(req); }
  catch { return json(res, 400, { error: "Invalid JSON" }); }

  const transcript = (body.transcript || "").trim();
  if (!transcript) return json(res, 400, { error: "Empty transcript" });
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return json(res, 413, {
      error: "Transcript too long",
      maxChars: MAX_TRANSCRIPT_CHARS,
    });
  }

  // Check entitlement
  const state = await getUserProState(userId);
  if (!state.pro) {
    // Free user — enforce monthly cap
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const usedThisMonth = state.summaryMonth === currentMonth ? state.summaryCount : 0;
    if (usedThisMonth >= FREE_TIER_LIMIT) {
      return json(res, 402, {
        error: "Free tier limit reached",
        used: usedThisMonth,
        limit: FREE_TIER_LIMIT,
        upgradeRequired: true,
      });
    }
  }

  // Call Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return json(res, 500, { error: "Server not configured" });

  const systemPrompt = `You are a precise transcript summarizer. Given a raw transcript, you produce a JSON object with these exact keys:
- "summary": 2-3 plain sentence summary of the whole content.
- "keyPoints": array of 4-6 short bullet strings (the most important points, no fluff).
- "actionItems": array of action items found in the transcript (empty array if none).
- "chapters": array of { "title": string, "timestamp": number_in_seconds } for major topic shifts. If the transcript is short (under ~3 minutes) return an empty array.

Output ONLY the JSON object, nothing else. Do not include markdown code fences.`;

  const userPrompt = `Duration: ${body.durationSec || "unknown"} seconds.\n\nTranscript:\n${transcript}`;

  let groqResponse;
  try {
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // Don't use response_format:json_object — it fails on some inputs
        // ("Failed to generate JSON"). We extract JSON from text below.
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });
  } catch (e) {
    return json(res, 502, { error: "Summary service unreachable" });
  }

  if (!groqResponse.ok) {
    const text = await groqResponse.text().catch(() => "");
    return json(res, 502, {
      error: "Summary service error",
      detail: text.slice(0, 500),
    });
  }

  let groqJson;
  try { groqJson = await groqResponse.json(); }
  catch { return json(res, 502, { error: "Bad summary response" }); }

  const content = groqJson?.choices?.[0]?.message?.content || "";
  const parsed = extractJsonObject(content);
  if (!parsed) {
    return json(res, 502, {
      error: "Summary returned invalid JSON",
      detail: content.slice(0, 200),
    });
  }

  // Successful summary — increment the free-tier counter only for non-Pro
  let usageAfter = null;
  if (!state.pro) {
    try { usageAfter = await incrementSummaryCount(userId); } catch {}
  }

  return json(res, 200, {
    summary: parsed.summary || "",
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
    pro: state.pro,
    usage: state.pro ? null : {
      used: usageAfter,
      limit: FREE_TIER_LIMIT,
    },
  });
}
