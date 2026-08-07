# Contest Hunter

Tracks scraped Instagram giveaways and drafts entry answers. React + Vite on the
front, Supabase (Postgres, Auth, Edge Functions) behind it, Stripe for billing.

## How the data fits together

- `contests` — a **shared catalog** produced by the scraper. Read-only to users.
- `user_contests` — one row per (user, contest) the user is tracking. This is
  where `status` and `saved` live, so two accounts never see each other's board.
- `profiles` — name plus the answer defaults (tone, personal angle).
- `subscriptions` — plan state. **Only the Stripe webhook writes `plan`**; users
  have SELECT and nothing else, so nobody can promote themselves.
- `answer_drafts` — generated answers, owned by the user.

A signup trigger provisions the profile and a free-plan row. A second trigger
enforces the free-tier cap of 5 tracked contests **in the database**, so the
limit holds even against someone calling the REST API directly.

## Local setup

```bash
npm install
cp .env.example .env   # then fill in the values below
npm run dev
```

`.env` needs:

| Key | Where it comes from |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | same page (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **local scripts only, never the browser** |

## Seeding the catalog

```bash
node scripts/seed-contests.mjs
```

Upserts `src/data/instagram-giveaways.json` on `post_url`. Safe to re-run: it
refreshes scraped fields and never touches anyone's tracking rows. Needs
`SUPABASE_SERVICE_ROLE_KEY`, because `anon` has no INSERT on the catalog.

## Remaining setup (needs your accounts)

### 1. Google OAuth

Supabase → Authentication → Providers → Google. Create an OAuth client in Google
Cloud Console and add this redirect URI:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Until this is configured the "Continue with Google" button returns a provider
error. Email/password works without it.

### 2. Auth URLs

Supabase → Authentication → URL Configuration:

- Site URL: your deployed origin (e.g. `https://contesthunter.app`)
- Redirect URLs: add `<origin>/auth/callback` and `<origin>/reset-password`

Password reset and email confirmation links break without these.

### 3. Stripe

Create a **recurring** Price for the Pro plan, then set the function secrets:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=rk_live_...        \
  STRIPE_WEBHOOK_SECRET=whsec_...      \
  STRIPE_PRO_PRICE_ID=price_...        \
  APP_URL=https://your-domain           \
  OPENROUTER_API_KEY=sk-or-...
```

Use a **restricted key** (`rk_`) scoped to Checkout Sessions, Customers, Billing
Portal and Subscriptions rather than a full secret key.

Add the webhook endpoint in Stripe → Developers → Webhooks:

```
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Subscribe it to `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret into
`STRIPE_WEBHOOK_SECRET`.

`APP_URL` is what Stripe redirects back to. It is read server-side on purpose —
taking the return URL from the request body would be an open redirect.

### 4. SPA rewrites

The app uses `BrowserRouter`, so your host must serve `index.html` for unknown
paths. Vite's dev server already does. On Vercel/Netlify add a catch-all rewrite
to `/index.html`, or deep links like `/settings` will 404 on refresh.

## Edge functions

| Function | JWT | Purpose |
| --- | --- | --- |
| `create-checkout-session` | required | Starts a subscription Checkout |
| `create-portal-session` | required | Opens the Stripe customer portal |
| `stripe-webhook` | **disabled** | Stripe can't send a Supabase JWT; authenticity comes from signature verification instead |
| `generate-answer` | required | Pro-only AI drafts; re-checks the plan server-side |

Deploy with `supabase functions deploy <name>`, and the webhook with
`--no-verify-jwt`.

## Plans

| | Free | Pro |
| --- | --- | --- |
| Browse catalog | ✅ | ✅ |
| Tracked contests | 5 | unlimited |
| Answer drafts | templates | AI-written |

The tracked-contest cap is enforced by a database trigger; the AI gate is
enforced inside the `generate-answer` function. Neither relies on the UI.
