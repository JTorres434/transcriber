// GET /api/config
// Returns the public configuration needed by the frontend.
// Safe to expose — only PUBLIC keys / non-secret config.
import { json } from "./_lib.js";

export default function handler(req, res) {
  return json(res, 200, {
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || null,
    // Whether the server has the keys configured to enable Pro features.
    // If any are missing, the frontend hides the Pro UI gracefully.
    proEnabled: !!(
      process.env.CLERK_SECRET_KEY &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.GROQ_API_KEY
    ),
  });
}
