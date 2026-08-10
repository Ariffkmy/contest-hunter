// Shared shape logic for contests: a public.contests row in, the shape the
// dashboard renders out.
//
// This used to run in both directions — the retired seed script built rows from
// a JSON dump through toContestRow(), inferring `prompt` from the caption with
// a regex. The scraper agent writes those columns itself now (see
// docs/scraper-agent-prompt.md), so the write half is gone and there is one
// producer of catalogue rows instead of two disagreeing ones.

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

export function formatEffort({ contestType, conditions }) {
  const type = contestType?.replaceAll("&", " & ") ?? "entry";
  const steps = conditions?.length ?? 0;
  return `${steps} step${steps === 1 ? "" : "s"} · ${type}`;
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
