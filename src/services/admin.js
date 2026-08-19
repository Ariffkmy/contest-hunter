// Thin client for the admin edge function.
//
// There is no Supabase query here on purpose. RLS is owner-only, so the browser
// could not read other accounts even with an admin session — the function holds
// the service role and does the authorisation check itself.

import { supabase } from "./supabaseClient.js";

export async function fetchAdminUsers() {
  const { data, error } = await supabase.functions.invoke("admin-users");
  if (error) return { users: [], error: error.message };
  if (data?.error) return { users: [], error: data.error };
  return { users: data.users ?? [], generatedAt: data.generatedAt, error: null };
}

/** Settings, joined contests and answer drafts for one account. */
export async function fetchAdminUserDetail(userId) {
  const { data, error } = await supabase.functions.invoke("admin-user-detail", {
    body: { userId }
  });
  if (error) return { detail: null, error: error.message };
  if (data?.error) return { detail: null, error: data.error };
  return { detail: data, error: null };
}

/**
 * Comps an account onto Pro.
 *
 * Primary path is the Vercel route (api/admin-grant-pro.js), which holds the
 * service role key — the Supabase edge function lives on an account we can't
 * deploy to, and a direct write is refused by owner-only RLS. Both older paths
 * stay in place as fallbacks in case the route isn't deployed yet.
 */
export async function grantPro(userId) {
  const failures = [];

  // 1. Vercel serverless function, authorised with the admin's own JWT.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return { subscription: null, error: "Your session has expired. Sign in again." };

    const response = await fetch("/api/admin-grant-pro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ userId })
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.subscription) {
      return { subscription: payload.subscription, error: null };
    }
    // 401/403 are verdicts, not outages — retrying elsewhere would only produce
    // a more confusing message.
    if (response.status === 401 || response.status === 403) {
      return { subscription: null, error: payload.error ?? "Not authorised" };
    }
    failures.push(`API route: ${payload.error ?? response.status}`);
  } catch (error) {
    failures.push(`API route: ${error.message}`);
  }

  // 2. Direct update (works only if RLS ever grants admins write access).
  const { data, error: directError } = await supabase
    .from("subscriptions")
    .update({ plan: "pro", status: "active", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();

  if (!directError && data) {
    return {
      subscription: {
        plan: data.plan,
        planStatus: data.status,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: Boolean(data.cancel_at_period_end)
      },
      error: null
    };
  }
  failures.push(`Direct update: ${directError?.message ?? "no row updated"}`);

  // 3. Supabase edge function.
  const { data: fnData, error: fnError } = await supabase.functions.invoke("admin-grant-pro", {
    body: { userId }
  });
  if (!fnError && fnData?.subscription) return { subscription: fnData.subscription, error: null };
  failures.push(`Edge function: ${fnData?.error ?? fnError?.message ?? "no response"}`);

  return { subscription: null, error: failures.join(" · ") };
}

/** Fire-and-forget: a failed audit write must never block a sign-in. */
export async function recordLogin() {
  try {
    await supabase.functions.invoke("record-login");
  } catch {
    // Offline, or the function isn't deployed yet.
  }
}

const BROWSERS = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"]
];

const PLATFORMS = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows NT/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
  [/Expo|okhttp/, "Mobile app"]
];

function match(table, value) {
  for (const [pattern, label] of table) {
    if (pattern.test(value)) return label;
  }
  return null;
}

/**
 * "Chrome on Windows" from a user-agent string. Chromium browsers all claim
 * Safari, so the browser table is ordered most-specific-first.
 */
export function describeDevice(userAgent) {
  if (!userAgent) return "Unknown device";
  const browser = match(BROWSERS, userAgent);
  const platform = match(PLATFORMS, userAgent);
  if (browser && platform) return `${browser} on ${platform}`;
  return browser ?? platform ?? "Unknown device";
}
