// Thin client for the admin edge function.
//
// There is no Supabase query here on purpose. RLS is owner-only, so the browser
// could not read other accounts even with an admin session — the function holds
// the service role and does the authorisation check itself.

import { supabase } from "./supabaseClient.js";

export async function fetchAdminUsers() {
  const { data, error } = await supabase.functions.invoke("admin-users");
  if (error) return { users: [], error: error.message };
  if (data?.error) return { users: [], error: data.error };
  return { users: data.users ?? [], generatedAt: data.generatedAt, error: null };
}

/** Settings, joined contests and answer drafts for one account. */
export async function fetchAdminUserDetail(userId) {
  const { data, error } = await supabase.functions.invoke("admin-user-detail", {
    body: { userId }
  });
  if (error) return { detail: null, error: error.message };
  if (data?.error) return { detail: null, error: data.error };
  return { detail: data, error: null };
}

/** Fire-and-forget: a failed audit write must never block a sign-in. */
export async function recordLogin() {
  try {
    await supabase.functions.invoke("record-login");
  } catch {
    // Offline, or the function isn't deployed yet.
  }
}

const BROWSERS = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"]
];

const PLATFORMS = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows NT/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
  [/Expo|okhttp/, "Mobile app"]
];

function match(table, value) {
  for (const [pattern, label] of table) {
    if (pattern.test(value)) return label;
  }
  return null;
}

/**
 * "Chrome on Windows" from a user-agent string. Chromium browsers all claim
 * Safari, so the browser table is ordered most-specific-first.
 */
export function describeDevice(userAgent) {
  if (!userAgent) return "Unknown device";
  const browser = match(BROWSERS, userAgent);
  const platform = match(PLATFORMS, userAgent);
  if (browser && platform) return `${browser} on ${platform}`;
  return browser ?? platform ?? "Unknown device";
}
