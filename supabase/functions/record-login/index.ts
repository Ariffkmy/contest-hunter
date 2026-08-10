// Records one sign-in for the calling user.
//
// The page calls this on the SIGNED_IN auth event. Everything stored is taken
// from the JWT or from request headers — never from the body — so a caller can
// neither log a sign-in for somebody else nor forge the device it came from.

import { adminClient, corsHeaders, json, requireUser } from "../_shared/deps.ts";

/** First hop in X-Forwarded-For is the client; the rest are proxies. */
function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const { error } = await adminClient().from("login_events").insert({
      user_id: user.id,
      user_agent: req.headers.get("user-agent"),
      ip: clientIp(req),
      provider: user.app_metadata?.provider ?? "email"
    });

    if (error) {
      // A failed audit write must not break the sign-in the user just made.
      console.error("record-login insert failed", error.message);
      return json({ recorded: false }, 200);
    }

    return json({ recorded: true });
  } catch (error) {
    console.error("record-login failed", error);
    return json({ recorded: false }, 200);
  }
});
