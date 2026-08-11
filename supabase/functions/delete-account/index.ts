// delete-account — permanent account deletion for Contest Hunter.
//
// The anon key cannot delete users (admin API only), so this edge function
// runs with the service role and is locked down to the caller's own session:
// we resolve the user from their JWT and never accept a user id from the
// client. Deleting a user from auth.users cascades to their auth metadata;
// user-owned rows we know about (subscriptions) are cleared first.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    if (!SERVICE_ROLE_KEY) {
      return json({ error: "delete-account is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Not signed in" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Resolve the caller from their own token.
    const {
      data: { user },
      error: userError
    } = await admin.auth.getUser(token);
    if (userError || !user) {
      return json({ error: "Session expired — sign in again" }, 401);
    }

    // Clear user-owned rows first. The table may not exist on older projects,
    // so treat "does not exist" as a no-op.
    const { error: subError } = await admin.from("subscriptions").delete().eq("user_id", user.id);
    if (subError && !/does not exist/i.test(subError.message)) {
      console.error("delete-account: failed to clear subscriptions:", subError.message);
      return json({ error: "Could not clear account data" }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("delete-account:", message);
    return json({ error: "Could not delete account" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };
}
