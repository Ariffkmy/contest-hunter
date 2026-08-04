import giveaways from "./data/instagram-giveaways.json";

const statusMap = {
  teaser: "upcoming",
  active: "in_progress",
  expired: "completed",
  winners: "completed"
};

const artGradients = [
  "linear-gradient(135deg, rgba(255,246,240,.9), rgba(233,103,112,.72))",
  "linear-gradient(135deg, rgba(18,83,89,.72), rgba(244,162,97,.58))",
  "linear-gradient(135deg, rgba(35,61,77,.72), rgba(252,191,73,.6))",
  "linear-gradient(135deg, rgba(77,124,138,.72), rgba(255,221,210,.72))",
  "linear-gradient(135deg, rgba(21,97,109,.76), rgba(240,184,77,.62))"
];

export const scrapeMeta = {
  scrapedAt: giveaways.scraped_at,
  source: giveaways.source,
  total: giveaways.total
};

export const contests = giveaways.contests.map((contest, index) => ({
  id: `ig-${index + 1}`,
  status: statusMap[contest.status] ?? "in_progress",
  rawStatus: contest.status,
  brand: contest.brand,
  handle: `@${contest.username}`,
  username: contest.username,
  profileUrl: contest.profile_url,
  prize: contest.prize,
  prompt: inferPrompt(contest),
  caption: stripCaption(contest.caption),
  deadline: contest.deadline || "Not stated",
  startsAt: contest.posted_at || "Not stated",
  effort: formatEffort(contest),
  source: contest.note || contest.contest_type || "Instagram giveaway",
  instagramUrl: contest.post_url,
  saved: false,
  conditions: contest.conditions ?? [],
  contestType: contest.contest_type,
  engagement: contest.engagement ?? { likes: 0, comments: 0 },
  art: artGradients[index % artGradients.length],
  raw: contest
}));

function stripCaption(caption = "") {
  return caption.replace(/^"|"[.]?$/g, "").trim();
}

function formatEffort(contest) {
  const type = contest.contest_type?.replaceAll("&", " & ") ?? "entry";
  const steps = contest.conditions?.length ?? 0;
  return `${steps} step${steps === 1 ? "" : "s"} · ${type}`;
}

function inferPrompt(contest) {
  const caption = stripCaption(contest.caption);
  const quotedPrompt = caption.match(/"([^"]{12,140}(?:because|why|tell|share|complete)[^"]*)"/i);
  if (quotedPrompt?.[1]) return quotedPrompt[1].trim();

  const sentencePrompt = caption
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /complete|tell us|share|why|comment|answer|describe/i.test(line));

  if (sentencePrompt) return sentencePrompt.replace(/^[-•✅\d\s.]+/, "").trim();
  return `What would make you the perfect winner for ${contest.prize}?`;
}
