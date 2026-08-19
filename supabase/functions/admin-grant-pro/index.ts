// Comps an account onto Pro from the admin console.
//
// Same authorisation shape as admin-users and admin-user-detail: the caller's
// JWT resolves to a user, that user's profile must have is_admin, and only then
// does the service-role client write. RLS on `subscriptions` is owner-only and
// grants nobody write access, so this function is the only path in.
//
// `stripe-webhook` is otherwise the only writer of `subscriptions.plan`. A grant
// made here carries no stripe_subscription_id, so nothing renews it and nothing
// bills for it — and if Stripe later sends an event for this account, the
// webhook will overwrite `plan` with whatever the real subscription says.

import { adminClient, corsHeaders, json, requireUser } from "../_shared/deps.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const admin = adminClient();

    const { data: caller } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    // Same response for "not an admin" as for "no such profile": a probe should
    // not be able to tell the difference.
    if (!caller?.is_admin) return json({ error: "Not authorised" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : null;
    if (!userId) return json({ error: "userId is required" }, 400);

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

    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "No such account." }, 404);

    console.log("granted pro", { userId, by: user.id });

    return json({
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
    return json({ error: "Could not grant Pro to that account." }, 500);
  }
});
