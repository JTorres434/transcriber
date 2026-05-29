// GET /api/me — current user's Pro + usage state
import {
  verifyClerkSession,
  getUserProState,
  cloudSecondsToday,
  isLimitedHost,
  json,
} from "./_lib.js";

export default async function handler(req, res) {
  const userId = await verifyClerkSession(req);
  if (!userId) return json(res, 401, { error: "Sign in required" });
  const state = await getUserProState(userId);
  // Non-public hosts (Vercel preview, localhost) bypass the quota — surface
  // them to the client as Pro so the entire UI (paywall, status line, etc.)
  // treats them as unlimited without any client-side branching.
  const effectivePro = state.pro || !isLimitedHost(req);
  return json(res, 200, {
    pro: effectivePro,
    proSince: state.proSince,
    summaryCount: state.summaryCount,
    summaryMonth: state.summaryMonth,
    cloudSecondsUsed: cloudSecondsToday(state),
    cloudFreeSeconds: 10 * 60,
    summaryFreeLimit: 2,
    email: state.email,
  });
}
