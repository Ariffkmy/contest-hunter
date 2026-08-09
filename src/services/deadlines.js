// Deadlines in the scraped data are free text: "2026-09-30", "TBD",
// "2026-08-08 11:59pm (winner 10 Aug)", "End Aug 2026", or empty.
// We only trust an explicit YYYY-MM-DD anywhere in the string; everything else
// is treated as undated rather than guessed at, so "closing soon" never lies.
//
// Shared shape with the mobile app's src/services/deadlines.js.

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/;

export function parseDeadline(raw) {
  if (!raw) return null;
  const match = String(raw).match(ISO_DATE);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today to `date`. Negative once the date has passed. */
export function daysUntil(date) {
  if (!date) return null;
  return Math.round((date.getTime() - startOfToday().getTime()) / 86400000);
}

export function describeDeadline(raw) {
  const date = parseDeadline(raw);
  if (!date) {
    return { label: raw?.trim() || "No deadline", urgency: "undated", days: null };
  }

  const days = daysUntil(date);
  if (days < 0) return { label: "Closed", urgency: "closed", days };
  if (days === 0) return { label: "Closes today", urgency: "critical", days };
  if (days === 1) return { label: "Closes tomorrow", urgency: "critical", days };
  if (days <= 7) return { label: `${days} days left`, urgency: "soon", days };
  if (days <= 30) return { label: `${days} days left`, urgency: "later", days };

  return { label: formatDate(date), urgency: "later", days };
}

export function formatDate(date) {
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatTimestamp(iso) {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : formatDate(date);
}

export function relativeFromNow(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(then);
}
