// All contest reads/writes for the signed-in user.
//
// The catalog (public.contests) and the user's tracking rows
// (public.user_contests) are fetched separately and merged in memory. Two small
// indexed queries beat a view here, and it keeps RLS reasoning simple: each
// query is scoped by its own policy.

import { supabase } from "./supabaseClient.js";
import { toUiContest } from "./contestMapper.js";

const CONTEST_COLUMNS =
  "id, post_url, brand, username, profile_url, caption, prize, prompt, conditions, " +
  "contest_type, note, deadline, posted_at, likes, comments, raw_status, source, scraped_at, image_url"

/** The trigger in 001 raises this prefix when a free account is at its cap. */
export const FREE_LIMIT_MARKER = "FREE_PLAN_LIMIT";

export function isFreeLimitError(message) {
  return typeof message === "string" && message.includes(FREE_LIMIT_MARKER);
}

export async function fetchDashboard(userId) {
  const [catalog, tracking] = await Promise.all([
    // Expired contests are filtered here rather than in the RLS policy, so the
    // rows stay reachable for admin surfaces that want the whole catalogue.
    // The flag is set daily by the expire-contests edge function.
    supabase
          .from("contests")
          .select(CONTEST_COLUMNS)
          .order("scraped_at", { ascending: false }),
    supabase.from("user_contests").select("contest_id, status, saved").eq("user_id", userId)
  ]);

  if (catalog.error) return { contests: [], meta: null, error: catalog.error.message };
  if (tracking.error) return { contests: [], meta: null, error: tracking.error.message };

  const byContest = new Map(tracking.data.map((row) => [row.contest_id, row]));
  const contests = catalog.data.map((row, index) =>
    toUiContest(row, index, byContest.get(row.id) ?? null)
  );

  // Catalogue freshness, same shape the mobile app reports. Rows come back
  // newest-scrape-first, so the head row dates the whole snapshot.
  const meta = {
    total: catalog.data.length,
    scrapedAt: catalog.data[0]?.scraped_at ?? null,
    source: catalog.data[0]?.source ?? null
  };

  return { contests, meta, error: null };
}

/**
 * Writes the user's workflow state for one contest, creating the tracking row
 * on first touch. The free-plan cap is enforced by a trigger on insert, so the
 * error surfaced here is authoritative rather than advisory.
 */
async function upsertTracking(userId, contestId, patch) {
  const { error } = await supabase
    .from("user_contests")
    .upsert({ user_id: userId, contest_id: contestId, ...patch }, { onConflict: "user_id,contest_id" });
  return { error: error?.message ?? null };
}

export function setContestStatus(userId, contestId, status) {
  return upsertTracking(userId, contestId, { status });
}

export function setContestSaved(userId, contestId, saved) {
  return upsertTracking(userId, contestId, { saved });
}

/** Drops the tracking row entirely, freeing a slot on the free plan. */
export async function untrackContest(userId, contestId) {
  const { error } = await supabase
    .from("user_contests")
    .delete()
    .eq("user_id", userId)
    .eq("contest_id", contestId);
  return { error: error?.message ?? null };
}

export async function saveAnswerDraft({ userId, contestId, personalAngle, answer, model }) {
  const { error } = await supabase.from("answer_drafts").insert({
    user_id: userId,
    contest_id: contestId,
    // answer_drafts.tone is NOT NULL and tone is no longer a user choice.
    // Write a fixed marker rather than migrate the live table; the column
    // is vestigial and can be dropped when convenient.
    tone: "standard",
    personal_angle: personalAngle,
    answer,
    model: model ?? null
  });
  return { error: error?.message ?? null };
}
