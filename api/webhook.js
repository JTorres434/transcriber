// POST /api/webhook
// Stripe webhook endpoint. Marks/unmarks the user's Pro status in Clerk.
// Stripe sends events; we react to subscription lifecycle.
import Stripe from "stripe";
import { clerk, json } from "./_lib.js";

// Important: Vercel default body parsing breaks Stripe signature verification.
// We need the raw body. Use `config` to disable parsing.
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

async function setProForUser(clerkUserId, pro, stripeCustomerId, since) {
  if (!clerkUserId) return;
  try {
    const user = await clerk.users.getUser(clerkUserId);
    const publicMeta = user.publicMetadata || {};
    const privateMeta = user.privateMetadata || {};
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...publicMeta,
        pro,
        proSince: pro ? (since || publicMeta.proSince || new Date().toISOString()) : null,
      },
      privateMetadata: {
        ...privateMeta,
        stripeCustomerId: stripeCustomerId || privateMeta.stripeCustomerId,
      },
    });
  } catch (e) {
    console.error("Failed to update Clerk user:", e?.message || e);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) return json(res, 500, { error: "Server not configured" });

  const stripe = new Stripe(stripeKey);
  const sig = req.headers["stripe-signature"];
  const raw = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    return json(res, 400, { error: `Webhook signature failed: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clerkUserId = session.client_reference_id || session.metadata?.clerkUserId;
      const customer = session.customer;
      await setProForUser(clerkUserId, true, customer);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const sub = event.data.object;
      const clerkUserId = sub.metadata?.clerkUserId;
      const active = ["active", "trialing"].includes(sub.status);
      await setProForUser(clerkUserId, active, sub.customer);
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const clerkUserId = sub.metadata?.clerkUserId;
      await setProForUser(clerkUserId, false, sub.customer);
    }
    // Other events: ignore
    return json(res, 200, { received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return json(res, 500, { error: "Handler failed" });
  }
}
