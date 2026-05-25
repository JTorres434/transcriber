// GET /api/me
// Auth: Bearer <clerk_session_jwt>
// Returns the current user's Pro state. Used by the frontend after sign-in
// or after returning from Stripe Checkout to refresh entitlement.
import { verifyClerkSession, getUserProState, json } from "./_lib.js";

export default async function handler(req, res) {
  const userId = await verifyClerkSession(req);
  if (!userId) return json(res, 401, { error: "Sign in required" });
  const state = await getUserProState(userId);
  return json(res, 200, state);
}
