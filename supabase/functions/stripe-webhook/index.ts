import { adminClient, json, stripeClient } from "../_shared/deps.ts";

// Stripe statuses that should unlock Pro. `past_due` stays enabled while the
// card is retried; Stripe moves it to `canceled` or `unpaid` when dunning ends.
const ENTITLED = new Set(["active", "trialing", "past_due"]);

/**
 * The only writer of `subscriptions.plan`.
 *
 * Note this function must be deployed with --no-verify-jwt: Stripe cannot send
 * a Supabase JWT. Authenticity comes from the signature check below instead,
 * which is why an unverified event is rejected before anything is read.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) return json({ error: "Missing signature" }, 400);

  const stripe = stripeClient();
  const payload = await req.text();

  let event;
  try {
    // Async variant: the sync one uses node crypto and fails on Deno.
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Signature verification failed", error);
    return json({ error: "Invalid signature" }, 400);
  }

  const admin = adminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // Nothing to persist here beyond the customer link: the subscription
        // events below carry the authoritative status and period.
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
        if (userId && session.customer) {
          await admin
            .from("subscriptions")
            .update({ stripe_customer_id: String(session.customer) })
            .eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const entitled =
          event.type !== "customer.subscription.deleted" && ENTITLED.has(subscription.status);

        const periodEnd = subscription.items?.data?.[0]?.current_period_end;

        const patch = {
          plan: entitled ? "pro" : "free",
          status: subscription.status,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
        };

        // Match on the Stripe customer rather than trusting metadata, so a
        // subscription created from the Dashboard still lands on the right row.
        const { data: updated } = await admin
          .from("subscriptions")
          .update(patch)
          .eq("stripe_customer_id", String(subscription.customer))
          .select("user_id");

        if (!updated?.length) {
          const userId = subscription.metadata?.supabase_user_id;
          if (userId) {
            await admin
              .from("subscriptions")
              .update({ ...patch, stripe_customer_id: String(subscription.customer) })
              .eq("user_id", userId);
          } else {
            console.error("No subscription row matched", subscription.id);
          }
        }
        break;
      }

      default:
        // Everything else is acknowledged so Stripe stops retrying.
        break;
    }
  } catch (error) {
    // Return 500 so Stripe retries rather than dropping the state change.
    console.error("Webhook handling failed", event.type, error);
    return json({ error: "Handler failed" }, 500);
  }

  return json({ received: true });
});
