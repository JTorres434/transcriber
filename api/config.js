// GET /api/config
// Returns the public configuration needed by the frontend.
import { json } from "./_lib.js";

export default function handler(req, res) {
  const hasAuth = !!process.env.CLERK_SECRET_KEY;
  const hasStripe = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  return json(res, 200, {
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || null,
    proEnabled: hasAuth && hasStripe && hasGroq,
    cloudEnabled: hasAuth && hasGroq && hasBlob,
  });
}
