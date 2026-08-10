// Everything one account has in the app: settings, the contests they joined,
// and every answer draft they generated.
//
// Split out from admin-users rather than folded into it: drafts are long text
// and would multiply the list payload by the number of accounts, when the
// console only ever shows one expanded card at a time.
//
// Same authorisation shape as admin-users — the caller's is_admin is re-read
// server-side before the service-role client touches anything.

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

    if (!caller?.is_admin) return json({ error: "Not authorised" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : null;
    if (!userId) return json({ error: "userId is required" }, 400);

    const [profile, joined, drafts] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name, default_tone, personal_note, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("user_contests")
        .select(
          "contest_id, status, saved, created_at, updated_at, " +
            "contests (brand, username, prize, deadline, contest_type, post_url)"
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      admin
        .from("answer_drafts")
        .select("id, tone, personal_angle, answer, model, created_at, contests (brand, prize)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100)
    ]);

    if (joined.error) return json({ error: joined.error.message }, 500);
    if (drafts.error) return json({ error: drafts.error.message }, 500);

    return json({
      settings: {
        fullName: profile.data?.full_name ?? null,
        defaultTone: profile.data?.default_tone ?? null,
        personalNote: profile.data?.personal_note ?? "",
        profileCreatedAt: profile.data?.created_at ?? null,
        profileUpdatedAt: profile.data?.updated_at ?? null
      },
      contests: (joined.data ?? []).map((row) => ({
        contestId: row.contest_id,
        status: row.status,
        saved: row.saved,
        joinedAt: row.created_at,
        updatedAt: row.updated_at,
        brand: row.contests?.brand ?? "Unknown contest",
        username: row.contests?.username ?? null,
        prize: row.contests?.prize ?? null,
        deadline: row.contests?.deadline ?? null,
        contestType: row.contests?.contest_type ?? null,
        postUrl: row.contests?.post_url ?? null
      })),
      // Every generated draft, newest first. The schema has no "chosen" flag —
      // the app copies text to the clipboard and never tells us which one won.
      drafts: (drafts.data ?? []).map((row) => ({
        id: row.id,
        brand: row.contests?.brand ?? "Unknown contest",
        prize: row.contests?.prize ?? null,
        tone: row.tone,
        personalAngle: row.personal_angle,
        answer: row.answer,
        model: row.model,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("admin-user-detail failed", error);
    return json({ error: "Could not load that account." }, 500);
  }
});
