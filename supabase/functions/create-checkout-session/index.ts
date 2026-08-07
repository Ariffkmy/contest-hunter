import { adminClient, appUrl, corsHeaders, json, requireUser, stripeClient } from "../_shared/deps.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const priceId = Deno.env.get("STRIPE_PRO_PRICE_ID");
    if (!priceId) return json({ error: "STRIPE_PRO_PRICE_ID is not configured" }, 500);

    const stripe = stripeClient();
    const admin = adminClient();

    const { data: subscription } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscription?.plan === "pro") {
      return json({ error: "You are already subscribed." }, 400);
    }

    // Reuse the Stripe customer across checkouts so a user who subscribes,
    // cancels and returns keeps one billing history.
    let customerId = subscription?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      await admin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // client_reference_id is the link back to our user if metadata is ever
      // lost; the webhook checks both.
      client_reference_id: user.id,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${appUrl()}/pricing?checkout=success`,
      cancel_url: `${appUrl()}/pricing?checkout=cancelled`
    });

    return json({ url: session.url });
  } catch (error) {
    // Never echo the raw Stripe error to the client: it can contain key hints.
    console.error("create-checkout-session failed", error);
    return json({ error: "Could not start checkout. Please try again." }, 500);
  }
});
