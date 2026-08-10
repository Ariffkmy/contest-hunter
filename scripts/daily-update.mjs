#!/usr/bin/env node
// Daily pipeline for Contest Hunter: scrape Instagram -> sync mobile JSON -> seed Supabase.
//
//   node scripts/daily-update.mjs
//
// Steps (each is optional-safe):
//   1. scrape-contests.mjs   -> src/data/instagram-giveaways.json (new + existing posts)
//   2. copy JSON to the mobile app's data folder (offline fallback stays fresh)
//   3. seed-contests.mjs     -> upsert into public.contests (needs SUPABASE_SERVICE_ROLE_KEY in .env)
//
// Prints a compact summary line for the cron agent to relay to Telegram.

import { spawnSync } from "node:child_process";
import { readFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const JSON_PATH = resolve(root, "src/data/instagram-giveaways.json");
const MOBILE_JSON = "/Users/atiqahbaiduri/Documents/contest-hunter-mobile/src/data/instagram-giveaways.json";
const MOBILE_FALLBACK_JSON = "/Users/atiqahbaiduri/contest-hunter/contesthunter-mobile/src/data/instagram-giveaways.json";

function run(label, args, opts = {}) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 900_000, ...opts });
  const tail = (r.stdout || "").trim().split("\n").slice(-6).join(" | ");
  const errTail = (r.stderr || "").trim().split("\n").slice(-4).join(" | ");
  return { label, ok: r.status === 0, status: r.status, tail, errTail };
}

// 1. scrape
const scrape = run("scrape", ["scripts/scrape-contests.mjs"], { env: { ...process.env, CH_MAX_POSTS: "50" } });
console.log(`SCRAPE ${scrape.ok ? "OK" : "FAIL"} (exit ${scrape.status})`);
if (scrape.tail) console.log("  out:", scrape.tail);
if (scrape.errTail) console.log("  log:", scrape.errTail);
if (!scrape.ok) process.exitCode = 1;

// 2. sync mobile JSON copies
let synced = 0;
for (const dest of [MOBILE_JSON, MOBILE_FALLBACK_JSON]) {
  try {
    if (existsSync(dest)) { copyFileSync(JSON_PATH, dest); synced++; }
  } catch { /* non-fatal */ }
}
console.log(`SYNC mobile JSON: ${synced} copy(ies) updated`);

// 3. seed (only when a service role key is configured — anon can't INSERT by design)
let seedOk = false;
let seedMsg = "";
let env = {};
try {
  const raw = readFileSync(resolve(root, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env */ }

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  seedMsg = "SKIPPED (no SUPABASE_SERVICE_ROLE_KEY in .env)";
  console.log(`SEED ${seedMsg}`);
} else {
  const seed = run("seed", ["scripts/seed-contests.mjs"]);
  seedOk = seed.ok;
  console.log(`SEED ${seed.ok ? "OK" : "FAIL"} (exit ${seed.status})`);
  if (seed.tail) console.log("  out:", seed.tail);
  if (seed.errTail) console.log("  log:", seed.errTail);
  if (!seed.ok) process.exitCode = 1;
  seedMsg = seed.ok ? "ok" : "FAIL";
}

// compact final summary
let total = 0, scrapedAt = null;
try {
  const d = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  total = d.total; scrapedAt = d.scraped_at;
} catch { /* ignore */ }
console.log(`SUMMARY: total=${total} scraped_at=${scrapedAt} scrape=${scrape.ok ? "ok" : "FAIL"} seed=${seedMsg} sync=${synced}`);
