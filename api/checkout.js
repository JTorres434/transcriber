// POST /api/checkout
// Auth: Bearer <clerk_session_jwt>
// Creates a Stripe Checkout Session for the Pro subscription and returns its URL.
import Stripe from "stripe";
import { verifyClerkSession, clerk, json } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const userId = await verifyClerkSession(req);
  if (!userId) return json(res, 401, { error: "Sign in required" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  if (!stripeKey || !priceId) return json(res, 500, { error: "Server not configured" });

  const stripe = new Stripe(stripeKey);

  let email;
  let existingCustomerId;
  try {
    const user = await clerk.users.getUser(userId);
    email = user.emailAddresses?.[0]?.emailAddress;
    existingCustomerId = user.privateMetadata?.stripeCustomerId;
  } catch {
    return json(res, 500, { error: "Could not load user" });
  }
  if (!email) return json(res, 400, { error: "No email on account" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existingCustomerId || undefined,
      customer_email: existingCustomerId ? undefined : email,
      client_reference_id: userId,
      success_url: `${appUrl}/?upgraded=1#welcome-pro`,
      cancel_url: `${appUrl}/?upgrade_cancelled=1`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { clerkUserId: userId },
      },
      metadata: { clerkUserId: userId },
    });
    return json(res, 200, { url: session.url });
  } catch (e) {
    return json(res, 500, { error: e.message || "Checkout failed" });
  }
}
