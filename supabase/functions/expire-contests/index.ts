// Marks contests whose deadline has passed as expired. Meant to be called once
// a day by a cron job.
//
// The parse rule is deliberately identical to the one the UI trusts
// (src/services/deadlines.js): an explicit YYYY-MM-DD anywhere in the free-text
// `deadline` column, and nothing else. "TBD", "End Aug 2026" and "" are left
// alone rather than guessed at — a contest wrongly hidden is worse than one
// that lingers a few days.
//
// Runs under the service role, so it bypasses RLS and the read-only grant the
// browser has on public.contests. That makes it a privileged endpoint: it
// authenticates the caller against CRON_SECRET (or the service-role key)
// before touching anything.

import { adminClient, corsHeaders, json } from "../_shared/deps.ts";

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/;

/** Rows per read page and per update statement. Supabase caps reads at 1000. */
const PAGE_SIZE = 1000;
const UPDATE_CHUNK = 200;

/**
 * Today as YYYY-MM-DD. Dates in this table are wall-clock dates with no zone,
 * so "today" is whatever the audience's day is — configurable, defaulting to
 * UTC. Getting this wrong only ever shifts expiry by one day either way.
 */
function today(): string {
  const timeZone = Deno.env.get("EXPIRY_TIMEZONE") ?? "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/** The YYYY-MM-DD inside a free-text deadline, or null when there isn't one. */
export function parseDeadline(raw: string | null): string | null {
  if (!raw) return null;
  const match = String(raw).match(ISO_DATE);
  if (!match) return null;

  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Reject dates the calendar doesn't have (2026-02-30), which Date rolls over
  // silently. Round-tripping through Date is the cheapest check.
  const date = new Date(Date.UTC(Number(y), month - 1, day));
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== day) return null;

  return `${y}-${m}-${d}`;
}

/**
 * True once the deadline day is behind us. Both sides are zero-padded
 * YYYY-MM-DD, so a string compare is the same as a date compare — and avoids
 * inventing a timezone for the contest's own date.
 */
function hasPassed(deadline: string, now: string): boolean {
  return deadline < now;
}

/**
 * The cron caller proves itself with CRON_SECRET, or with the service-role key
 * as a bearer token for manual runs. Without one of those this endpoint would
 * let anyone force a full-table write.
 */
function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  if (secret && bearer === secret) return true;
  if (serviceKey && bearer === serviceKey) return true;
  return false;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const supabase = adminClient();
    const now = today();

    // Read every not-yet-expired contest, a page at a time. Only id and
    // deadline: the rest of the row is never looked at.
    const stale: string[] = [];
    let scanned = 0;
    let undated = 0;

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("contests")
        .select("id, deadline")
        .eq("is_expired", false)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("expire-contests read failed", error.message);
        return json({ error: error.message }, 500);
      }
      if (!data || data.length === 0) break;

      scanned += data.length;
      for (const row of data) {
        const deadline = parseDeadline(row.deadline);
        if (!deadline) {
          undated += 1;
          continue;
        }
        if (hasPassed(deadline, now)) stale.push(row.id);
      }

      if (data.length < PAGE_SIZE) break;
    }

    // Chunked so one statement never carries an unbounded IN list.
    let expired = 0;
    for (let i = 0; i < stale.length; i += UPDATE_CHUNK) {
      const chunk = stale.slice(i, i + UPDATE_CHUNK);
      const { data, error } = await supabase
        .from("contests")
        .update({ is_expired: true, updated_at: new Date().toISOString() })
        .in("id", chunk)
        .select("id");

      if (error) {
        // Partial progress is fine and is already committed — report what stuck
        // rather than pretending the whole run failed.
        console.error("expire-contests update failed", error.message, { expired });
        return json({ error: error.message, expired, scanned }, 500);
      }
      expired += data?.length ?? 0;
    }

    console.log(
      `expire-contests: marked ${expired} contest(s) expired ` +
        `(today=${now}, scanned=${scanned}, undated=${undated})`
    );

    return json({ expired, scanned, undated, today: now });
  } catch (error) {
    console.error("expire-contests failed", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

Deno.serve(handler);

export default handler;
