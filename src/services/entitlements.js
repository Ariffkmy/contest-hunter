// The single definition of what each plan unlocks.
//
// Kept identical to the mobile app's src/services/entitlements.js. A paywall
// that disagrees with itself across platforms is how users end up paying for
// something they already had — so this table is the one place either client
// decides what is gated.
//
// Client-side checks are for UX only. The generate-answer edge function
// re-reads the caller's plan before spending a token, and the tracking cap is
// enforced by a trigger on public.user_contests.

export const FREE_TRACKING_LIMIT = 5;

export const FEATURES = {
  AI_DRAFTS: "ai_drafts",
  UNLIMITED_TRACKING: "unlimited_tracking",
  ODDS_ANALYTICS: "odds_analytics",
  DEADLINE_ALERTS: "deadline_alerts"
};

const PRO_ONLY = new Set(Object.values(FEATURES));

export const FEATURE_COPY = {
  [FEATURES.AI_DRAFTS]: {
    title: "AI answer drafts",
    blurb: "Real model output written around your angle, instead of the built-in templates."
  },
  [FEATURES.UNLIMITED_TRACKING]: {
    title: "Unlimited tracking",
    blurb: `Free tracks ${FREE_TRACKING_LIMIT} contests at a time. Pro removes the cap.`
  },
  [FEATURES.ODDS_ANALYTICS]: {
    title: "Best odds & insights",
    blurb: "See which open contests have the fewest entries before you spend effort on them."
  },
  [FEATURES.DEADLINE_ALERTS]: {
    title: "Deadline reminders",
    blurb: "A push notification before a contest you're tracking closes. Mobile app only."
  }
};

export function isProPlan(plan) {
  return plan === "pro";
}

/** Every gate in both apps resolves through this one call. */
export function can(plan, feature) {
  if (!PRO_ONLY.has(feature)) return true;
  return isProPlan(plan);
}

export function canTrackMore(plan, trackedCount) {
  if (isProPlan(plan)) return true;
  return trackedCount < FREE_TRACKING_LIMIT;
}
