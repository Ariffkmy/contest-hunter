// Comps an account onto Pro from the admin console.
//
// This is the Vercel-hosted twin of supabase/functions/admin-grant-pro. The
// edge function can't be deployed (the Supabase project lives on a different
// account) and the browser can't write `subscriptions` directly because RLS is
// owner-only, so this route is the path in: it holds the service role key and
// does the authorisation check itself.
//
// `stripe-webhook` is otherwise the only writer of `subscriptions.plan`. A grant
// made here carries no stripe_subscription_id, so nothing renews it and nothing
// bills for it — and if Stripe later sends an event for this account, the
// webhook will overwrite `plan` with whatever the real subscription says.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("admin-grant-pro: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server is not configured for admin grants." });
  }

  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing authorization header" });

    // Service role, so no session is persisted and RLS is bypassed on writes.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Resolve the bearer token to a user. getUser(token) validates the JWT
    // against the project's signing key rather than trusting its claims.
    const { data: caller, error: authError } = await admin.auth.getUser(token);
    const user = caller?.user;
    if (authError || !user) return res.status(401).json({ error: "Invalid session" });

    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    // Same response for "not an admin" as for "no such profile": a probe should
    // not be able to tell the difference.
    if (!profile?.is_admin) return res.status(403).json({ error: "Not authorised" });

    // Vercel parses JSON bodies, but a raw string can still arrive if the
    // content type is off.
    const body = typeof req.body === "string" ? safeParse(req.body) : req.body ?? {};
    const userId = typeof body.userId === "string" ? body.userId : null;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // The signup trigger provisions a free-plan row, but upsert keeps this
    // working for accounts created before that trigger existed.
    const { data, error } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: "pro",
          status: "active",
          cancel_at_period_end: false
        },
        { onConflict: "user_id" }
      )
      .select("user_id, plan, status, current_period_end, cancel_at_period_end")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "No such account." });

    console.log("granted pro", { userId, by: user.id });

    return res.status(200).json({
      ok: true,
      subscription: {
        plan: data.plan,
        planStatus: data.status,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: Boolean(data.cancel_at_period_end)
      }
    });
  } catch (error) {
    console.error("admin-grant-pro failed", error);
    return res.status(500).json({ error: "Could not grant Pro to that account." });
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
