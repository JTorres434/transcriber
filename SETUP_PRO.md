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

## 3. Groq (AI summary)

1. https://console.groq.com → Sign up (free).
2. **API Keys → Create API Key** → copy (starts `gsk_…`).
3. Free tier covers ~14k tokens/min on Llama 3.3 70B — more than enough for summaries.

## 4. Vercel — add env vars

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

After adding, **redeploy** (Deployments → ⋮ on latest → Redeploy).

## 5. Test the flow

1. Open your site. Top-right should show **Sign in**.
2. Sign in (creates a free account).
3. Drop a file → Transcribe → click **AI Summary**. First two summaries each month are free.
4. After the second free, the paywall opens → **Upgrade to Pro** → Stripe Checkout.
5. Use Stripe's test card `4242 4242 4242 4242` with any future expiry + any CVC.
6. After payment, you return to the app and see the **Welcome to Pro** modal. AI Summary is now unlimited.

## Going live

When you're ready to take real payments:
1. Stripe dashboard: toggle from **Test mode** → **Live mode**.
2. Recreate the Product + Price in live mode.
3. Recreate the Webhook endpoint in live mode (gets a new signing secret).
4. Swap Stripe env vars on Vercel to the live ones.
5. Clerk: switch your instance from Development → Production (different keys).
