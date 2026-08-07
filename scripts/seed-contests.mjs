// Loads the scraper's JSON dump into public.contests.
//
//   node scripts/seed-contests.mjs
//
// Reads credentials from .env. Prefers SUPABASE_SERVICE_ROLE_KEY when present,
// since the anon key is only granted SELECT/UPDATE on contests by design — an
// insert needs the service role. Re-running is safe: rows upsert on post_url
// and the user's `status`/`saved` columns are never overwritten.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { toContestRow } from "../src/services/contestMapper.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!env[key]) env[key] = value.replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env, fall back to the real environment
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL and a key. Set them in .env first.");
  process.exit(1);
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "! No SUPABASE_SERVICE_ROLE_KEY found — using the anon key.\n" +
      "  This will fail unless the anon role has been temporarily granted INSERT.\n"
  );
}

const dump = JSON.parse(readFileSync(resolve(root, "src/data/instagram-giveaways.json"), "utf8"));
const rows = dump.contests.map((contest) =>
  toContestRow(contest, { source: dump.source, scrapedAt: dump.scraped_at })
);

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Safe to overwrite every column: this table is now a pure catalog. Per-user
// workflow state lives in user_contests, keyed on contest id, so re-seeding
// refreshes the scraped fields without touching anybody's tracking.
const { data, error } = await supabase
  .from("contests")
  .upsert(rows, { onConflict: "post_url", ignoreDuplicates: false })
  .select("id");

if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}

console.log(`Seeded ${data.length} contests from ${dump.scraped_at}.`);
