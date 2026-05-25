// Shared helpers for the Vercel serverless functions.
import { createClerkClient, verifyToken } from "@clerk/backend";

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Verify the Clerk session JWT from Authorization: Bearer <token>.
// Returns the userId, or null if invalid. We deliberately avoid throwing
// so callers can return a clean 401.
export async function verifyClerkSession(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload?.sub || null;
  } catch (_) {
    return null;
  }
}

// Read a user's Pro status from Clerk publicMetadata. Defaults to free.
export async function getUserProState(userId) {
  if (!userId) return { pro: false };
  try {
    const user = await clerk.users.getUser(userId);
    const meta = user.publicMetadata || {};
    return {
      pro: !!meta.pro,
      proSince: meta.proSince || null,
      summaryCount: meta.summaryCount || 0,
      summaryMonth: meta.summaryMonth || null,
      cloudSeconds: meta.cloudSeconds || 0,
      cloudMonth: meta.cloudMonth || null,
      email: user.emailAddresses?.[0]?.emailAddress || null,
    };
  } catch (_) {
    return { pro: false };
  }
}

// Returns how many cloud-transcription seconds the user has used this month
// (auto-resetting at month boundary).
export function cloudSecondsThisMonth(state) {
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (state.cloudMonth !== currentMonth) return 0;
  return state.cloudSeconds || 0;
}

// Adds N seconds of audio to the user's cloud-usage counter.
export async function addCloudSeconds(userId, seconds) {
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata || {};
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const baseline = meta.cloudMonth === currentMonth ? (meta.cloudSeconds || 0) : 0;
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      cloudSeconds: baseline + seconds,
      cloudMonth: currentMonth,
    },
  });
  return baseline + seconds;
}

// Increment monthly free-tier counter for non-Pro users.
export async function incrementSummaryCount(userId) {
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata || {};
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const isNewMonth = meta.summaryMonth !== currentMonth;
  const newCount = isNewMonth ? 1 : (meta.summaryCount || 0) + 1;
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      summaryCount: newCount,
      summaryMonth: currentMonth,
    },
  });
  return newCount;
}

// JSON response helpers
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
