// Shared setup for the billing functions.

import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

export { Stripe, createClient };

export const STRIPE_API_VERSION = "2026-06-24.dahlia";

export function stripeClient() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient()
  });
}

/** Service-role client. Bypasses RLS — only ever used for trusted server writes. */
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

/**
 * Resolves the caller from their Supabase JWT. Everything user-scoped derives
 * identity from here rather than from the request body, so a caller cannot act
 * on another account by editing what the page sends.
 */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { user: null, error: "Missing Authorization header" };

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { user: null, error: "Invalid or expired session" };
  return { user: data.user, error: null };
}

// Where Stripe sends users back to. Deliberately a server-side secret and not
// taken from the request: echoing a client-supplied URL into success_url would
// be an open redirect.
export function appUrl() {
  return Deno.env.get("APP_URL") ?? "http://127.0.0.1:5173";
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}
