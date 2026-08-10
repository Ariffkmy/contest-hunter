// Read-only admin view of every account.
//
// Authorisation is one check, server-side: the caller's JWT resolves to a user,
// that user's profile must have is_admin. Only then does the service-role
// client run. The browser never gets a key that can read other people's rows —
// it gets this function's JSON and nothing else.
//
// auth.users is not reachable through PostgREST at any privilege level, so the
// account facts (email, last sign-in, confirmation) come from the Auth admin
// API rather than a table read.

import { adminClient, corsHeaders, json, requireUser } from "../_shared/deps.ts";

/** Newest sign-in events per user, capped so one noisy account can't dominate. */
const LOGINS_PER_USER = 5;

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

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

    const [accounts, profiles, subscriptions, tracking, drafts, logins] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      admin.from("profiles").select("id, full_name, default_tone, is_admin, created_at"),
      admin
        .from("subscriptions")
        .select("user_id, plan, status, current_period_end, cancel_at_period_end"),
      admin.from("user_contests").select("user_id, status, saved"),
      admin.from("answer_drafts").select("user_id, created_at"),
      admin
        .from("login_events")
        .select("user_id, occurred_at, user_agent, ip, provider")
        .order("occurred_at", { ascending: false })
        .limit(500)
    ]);

    if (accounts.error) return json({ error: accounts.error.message }, 500);

    const profileById = new Map((profiles.data ?? []).map((row) => [row.id, row]));
    const subscriptionById = new Map((subscriptions.data ?? []).map((row) => [row.user_id, row]));
    const trackingByUser = groupBy(tracking.data ?? [], (row) => row.user_id);
    const draftsByUser = groupBy(drafts.data ?? [], (row) => row.user_id);
    const loginsByUser = groupBy(logins.data ?? [], (row) => row.user_id);

    const users = accounts.data.users.map((account) => {
      const rows = trackingByUser.get(account.id) ?? [];
      const history = loginsByUser.get(account.id) ?? [];

      return {
        id: account.id,
        email: account.email,
        createdAt: account.created_at,
        lastSignInAt: account.last_sign_in_at,
        confirmed: Boolean(account.email_confirmed_at),
        provider: account.app_metadata?.provider ?? "email",

        fullName: profileById.get(account.id)?.full_name ?? null,
        defaultTone: profileById.get(account.id)?.default_tone ?? null,
        isAdmin: Boolean(profileById.get(account.id)?.is_admin),

        plan: subscriptionById.get(account.id)?.plan ?? "free",
        planStatus: subscriptionById.get(account.id)?.status ?? null,
        currentPeriodEnd: subscriptionById.get(account.id)?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(subscriptionById.get(account.id)?.cancel_at_period_end),

        tracking: {
          total: rows.length,
          saved: rows.filter((row) => row.saved).length,
          upcoming: rows.filter((row) => row.status === "upcoming").length,
          inProgress: rows.filter((row) => row.status === "in_progress").length,
          completed: rows.filter((row) => row.status === "completed").length
        },
        draftCount: (draftsByUser.get(account.id) ?? []).length,

        // History is already newest-first from the query.
        logins: history.slice(0, LOGINS_PER_USER).map((row) => ({
          occurredAt: row.occurred_at,
          userAgent: row.user_agent,
          ip: row.ip,
          provider: row.provider
        })),
        loginCount: history.length
      };
    });

    users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return json({ users, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("admin-users failed", error);
    return json({ error: "Could not load the admin view." }, 500);
  }
});
