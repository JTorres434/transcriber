// POST /api/upload-token
// Issues a signed token for direct browser-to-Vercel-Blob upload.
// The browser calls this twice (token request + upload-complete callback),
// and @vercel/blob's client SDK manages the protocol. We verify the
// Clerk JWT via clientPayload since the SDK can't add Authorization headers.
import { handleUpload } from "@vercel/blob/client";
import { verifyToken } from "@clerk/backend";
import { json, readJsonBody } from "./_lib.js";

async function userIdFromClientPayload(payload) {
  if (!payload) return null;
  try {
    const token = typeof payload === "string" ? payload : payload.token;
    if (!token) return null;
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return decoded?.sub || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  let body;
  try { body = await readJsonBody(req); }
  catch { return json(res, 400, { error: "Invalid JSON" }); }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await userIdFromClientPayload(clientPayload);
        if (!userId) throw new Error("Sign in required");
        return {
          allowedContentTypes: [
            "audio/*", "video/*", "application/octet-stream",
          ],
          maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB cap
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async (_) => {
        // No-op. The transcribe-cloud endpoint will do the actual work.
      },
    });
    return json(res, 200, result);
  } catch (e) {
    return json(res, 400, { error: e.message || "Upload token failed" });
  }
}
