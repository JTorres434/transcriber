// GET /api/me — current user's Pro + usage state
import {
  verifyClerkSession,
  getUserProState,
  cloudSecondsThisMonth,
  json,
} from "./_lib.js";

export default async function handler(req, res) {
  const userId = await verifyClerkSession(req);
  if (!userId) return json(res, 401, { error: "Sign in required" });
  const state = await getUserProState(userId);
  return json(res, 200, {
    pro: state.pro,
    proSince: state.proSince,
    summaryCount: state.summaryCount,
    summaryMonth: state.summaryMonth,
    cloudSecondsUsed: cloudSecondsThisMonth(state),
    cloudFreeSeconds: 10 * 60,
    summaryFreeLimit: 2,
    email: state.email,
  });
}
