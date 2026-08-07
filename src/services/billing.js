// Thin client for the billing edge functions.
//
// The browser never talks to Stripe directly and never holds a Stripe secret:
// it asks our functions for a hosted URL and follows it. The user's identity
// comes from the Supabase JWT that invoke() attaches, not from anything the
// page sends, so a caller cannot check out or open a portal as someone else.

import { supabase } from "./supabaseClient.js";

export async function startCheckout() {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { returnTo: window.location.origin }
  });
  if (error) return { url: null, error: error.message };
  if (data?.error) return { url: null, error: data.error };
  return { url: data.url, error: null };
}

export async function openBillingPortal() {
  const { data, error } = await supabase.functions.invoke("create-portal-session", {
    body: { returnTo: `${window.location.origin}/settings` }
  });
  if (error) return { url: null, error: error.message };
  if (data?.error) return { url: null, error: data.error };
  return { url: data.url, error: null };
}
