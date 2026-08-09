// Derived numbers for the Home screen. Mirrors the mobile app's
// src/services/analytics.js so both dashboards report the same figures.
//
// "Entries" is the post's comment count. That is a proxy, not a fact: on a
// comment-to-enter giveaway it tracks entries closely, on a buy&win it mostly
// tracks chatter. The UI says "entries" but ranks only within contests you can
// actually still enter, which is where the proxy holds up best.

import { describeDeadline, parseDeadline } from "./deadlines.js";

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function buildStats(allContests) {
  const live = allContests.filter((c) => !c.deleted);

  const counts = {
    upcoming: live.filter((c) => c.status === "upcoming").length,
    in_progress: live.filter((c) => c.status === "in_progress").length,
    completed: live.filter((c) => c.status === "completed").length,
    saved: live.filter((c) => c.saved).length,
    tracked: live.filter((c) => c.tracked).length,
    deleted: allContests.filter((c) => c.deleted).length,
    total: live.length
  };

  const dated = live
    .filter((c) => c.status !== "completed")
    .map((c) => ({ contest: c, deadline: describeDeadline(c.deadline) }))
    .filter((row) => row.deadline.days !== null && row.deadline.days >= 0)
    .sort((a, b) => a.deadline.days - b.deadline.days);

  const closingSoon = dated.slice(0, 5);
  const closingThisWeek = dated.filter((row) => row.deadline.days <= 7).length;

  const bestOdds = live
    .filter((c) => c.status === "in_progress")
    .filter((c) => (c.engagement?.comments ?? 0) > 0)
    .sort((a, b) => (a.engagement.comments ?? 0) - (b.engagement.comments ?? 0))
    .slice(0, 5);

  const byType = Object.entries(
    live.reduce((acc, c) => {
      const key = c.contestType || "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type, count]) => ({ type, count }));

  const typeMax = byType.length ? byType[0].count : 0;

  const completionBase = counts.in_progress + counts.completed;
  const completionRate = completionBase ? Math.round((counts.completed / completionBase) * 100) : 0;

  return {
    counts,
    closingSoon,
    closingThisWeek,
    bestOdds,
    byType,
    typeMax,
    completionRate,
    completionBase,
    avgEntries: Math.round(average(live.map((c) => c.engagement?.comments ?? 0))),
    avgSteps: average(live.map((c) => c.conditions?.length ?? 0)).toFixed(1),
    undatedCount: live.filter((c) => !parseDeadline(c.deadline)).length
  };
}
