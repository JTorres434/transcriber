# Pro tier setup

Once these env vars are set on Vercel, sign-in + Pro upgrade + AI Summary all light up.
Until they're set, the app runs exactly like before (no Pro UI shown).

## 1. Clerk (auth)

1. Go to https://clerk.com → Sign up → Create application.
2. Choose your auth methods (Email is enough; Google/Apple optional).
3. **API Keys** in the sidebar → copy:
   - `Publishable key` (starts `pk_test_…` or `pk_live_…`)
   - `Secret key` (starts `sk_test_…`)
4. **Domain configuration** → add your Vercel URL (e.g. `transcriber-jtorres434s-projects.vercel.app`) as an authorized domain so Clerk's UI loads there.

## 2. Stripe (billing)

1. https://stripe.com → Sign up. Stay in **Test mode** for now (toggle top-right).
2. **Products → + Add product**
   - Name: `Pro`
   - Price: $9.00 USD, Recurring, Monthly
3. After creating, open the product → copy the **Price ID** (starts `price_…`).
4. **Developers → API keys** → copy **Secret key** (starts `sk_test_…`).
5. Webhook (do this AFTER deploy):
   - **Developers → Webhooks → + Add endpoint**
   - URL: `https://YOUR-VERCEL-DOMAIN/api/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - After creating, click the endpoint → copy the **Signing secret** (starts `whsec_…`).

## 3. Groq (AI summary + cloud transcription)

1. https://console.groq.com → Sign up (free).
2. **API Keys → Create API Key** → copy (starts `gsk_…`).
3. Free tier covers ~14k tokens/min on Llama 3.3 70B + Whisper Large v3 Turbo (~$0.04/hour of audio in paid mode, way more on free).

## 4. Vercel Blob (audio storage for cloud transcription)

Cloud transcription needs a place to stash users' uploads briefly. Vercel Blob handles this directly inside your project:

1. Vercel dashboard → your project → **Storage** tab.
2. **Connect Store → Blob**. Pick a region close to you.
3. After it's connected, Vercel automatically injects the `BLOB_READ_WRITE_TOKEN` env var into your project. Nothing to copy/paste.
4. Free tier: 1 GB total storage + 1 GB/mo bandwidth. (Audio files are deleted immediately after transcription, so storage rarely exceeds a few MB.)

## 5. Vercel — add env vars

In Vercel: **Project → Settings → Environment Variables**. Add:

| Name | Value |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | `pk_test_…` (from step 1) |
| `CLERK_SECRET_KEY` | `sk_test_…` (from step 1) |
| `STRIPE_SECRET_KEY` | `sk_test_…` (from step 2) |
| `STRIPE_PRICE_ID` | `price_…` (from step 2) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (from step 2, added after deploy) |
| `GROQ_API_KEY` | `gsk_…` (from step 3) |
| `APP_URL` | `https://transcriber-jtorres434s-projects.vercel.app` |

`BLOB_READ_WRITE_TOKEN` is added automatically when you connected Blob in step 4 — you don't add this one manually.

After adding, **redeploy** (Deployments → ⋮ on latest → Redeploy).

## 6. Test the flow

1. Open your site. Top-right should show **Sign in**.
2. Sign in (creates a free account).
3. Mode selector should default to **Cloud**. Drop a file → Transcribe.
4. First 10 minutes/month of cloud audio are free. After that the paywall opens.
5. Click **Upgrade to Pro** → Stripe Checkout. Use the test card `4242 4242 4242 4242` with any future expiry + any CVC.
6. After payment, you return to the app and see the **Welcome to Pro** modal. Cloud + AI Summary become unlimited.

## Going live

When you're ready to take real payments:
1. Stripe dashboard: toggle from **Test mode** → **Live mode**.
2. Recreate the Product + Price in live mode.
3. Recreate the Webhook endpoint in live mode (gets a new signing secret).
4. Swap Stripe env vars on Vercel to the live ones.
5. Clerk: switch your instance from Development → Production (different keys).
