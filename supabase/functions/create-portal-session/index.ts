import { adminClient, appUrl, corsHeaders, json, requireUser, stripeClient } from "../_shared/deps.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const admin = adminClient();
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // The customer id is looked up from the caller's own row, so a user can
    // only ever open their own portal.
    if (!subscription?.stripe_customer_id) {
      return json({ error: "No billing account yet. Subscribe first." }, 400);
    }

    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl()}/settings`
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("create-portal-session failed", error);
    return json({ error: "Could not open the billing portal. Please try again." }, 500);
  }
});
