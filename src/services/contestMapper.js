// Shared shape logic for contests.
//
// Both the app (reading rows from Supabase) and the seed generator (reading the
// scraper's JSON dump) go through here, so the derived fields — prompt, status,
// effort — stay identical no matter which side produced them.

const statusMap = {
  teaser: "upcoming",
  active: "in_progress",
  expired: "completed",
  winners: "completed"
};

export const artGradients = [
  "linear-gradient(135deg, rgba(255,246,240,.9), rgba(233,103,112,.72))",
  "linear-gradient(135deg, rgba(18,83,89,.72), rgba(244,162,97,.58))",
  "linear-gradient(135deg, rgba(35,61,77,.72), rgba(252,191,73,.6))",
  "linear-gradient(135deg, rgba(77,124,138,.72), rgba(255,221,210,.72))",
  "linear-gradient(135deg, rgba(21,97,109,.76), rgba(240,184,77,.62))"
];

export function statusFromRaw(rawStatus) {
  return statusMap[rawStatus] ?? "in_progress";
}

export function stripCaption(caption = "") {
  return caption.replace(/^"|"[.]?$/g, "").trim();
}

export function formatEffort({ contestType, conditions }) {
  const type = contestType?.replaceAll("&", " & ") ?? "entry";
  const steps = conditions?.length ?? 0;
  return `${steps} step${steps === 1 ? "" : "s"} · ${type}`;
}

export function inferPrompt({ caption, prize }) {
  const clean = stripCaption(caption);
  const quotedPrompt = clean.match(/"([^"]{12,140}(?:because|why|tell|share|complete)[^"]*)"/i);
  if (quotedPrompt?.[1]) return quotedPrompt[1].trim();

  const sentencePrompt = clean
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /complete|tell us|share|why|comment|answer|describe/i.test(line));

  if (sentencePrompt) return sentencePrompt.replace(/^[-•✅\d\s.]+/, "").trim();
  return `What would make you the perfect winner for ${prize}?`;
}

/**
 * Scraper JSON record -> the column set of public.contests.
 * Used by the seed generator; also the fallback path when Supabase is unset.
 */
export function toContestRow(contest, meta = {}) {
  // Some scraped posts are winner announcements rather than live giveaways and
  // carry no prize. Keep the column NOT NULL and give them a readable stand-in,
  // otherwise the answer generator trips over a null prize.
  const prize = contest.prize || "Prize not announced";

  return {
    post_url: contest.post_url,
    brand: contest.brand,
    username: contest.username,
    profile_url: contest.profile_url ?? null,
    caption: stripCaption(contest.caption),
    prize,
    prompt: inferPrompt({ caption: contest.caption, prize }),
    conditions: contest.conditions ?? [],
    contest_type: contest.contest_type ?? null,
    note: contest.note ?? null,
    deadline: contest.deadline || null,
    posted_at: contest.posted_at || null,
    likes: contest.engagement?.likes ?? 0,
    comments: contest.engagement?.comments ?? 0,
    raw_status: contest.status ?? null,
    source: meta.source ?? null,
    scraped_at: meta.scrapedAt ?? null
  };
}

/**
 * A public.contests row plus the signed-in user's public.user_contests row
 * (when one exists) -> the shape the dashboard renders.
 *
 * `tracking` is null for a contest the user has never acted on. Those still
 * appear in the list; their status falls back to whatever the scraper saw, and
 * `tracked: false` is what the free-plan counter keys on.
 *
 * `index` only drives the art gradient rotation.
 */
export function toUiContest(row, index = 0, tracking = null) {
  return {
    id: row.id,
    status: tracking?.status ?? statusFromRaw(row.raw_status),
    tracked: Boolean(tracking),
    rawStatus: row.raw_status,
    brand: row.brand,
    handle: `@${row.username}`,
    username: row.username,
    profileUrl: row.profile_url,
    prize: row.prize,
    prompt: row.prompt,
    caption: row.caption,
    deadline: row.deadline || "Not stated",
    startsAt: row.posted_at || "Not stated",
    effort: formatEffort({ contestType: row.contest_type, conditions: row.conditions }),
    source: row.note || row.contest_type || "Instagram giveaway",
    instagramUrl: row.post_url,
    saved: tracking?.saved ?? false,
    conditions: row.conditions ?? [],
    contestType: row.contest_type,
    engagement: { likes: row.likes ?? 0, comments: row.comments ?? 0 },
    art: artGradients[index % artGradients.length]
  };
}
