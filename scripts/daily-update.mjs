#!/usr/bin/env node
// Daily pipeline for Contest Hunter: scrape Instagram -> sync mobile JSON -> (scraper upserts to Supabase directly).
//
//   node scripts/daily-update.mjs
//
// Steps:
//   1. scrape-contests.mjs — scrapes IG hashtags via CDP, writes src/data/instagram-giveaways.json,
//      and upserts straight into public.contests when SUPABASE_SERVICE_ROLE_KEY is set in .env.
//   2. copy JSON to the mobile app's data folder (offline fallback stays fresh).
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

const MAX_POSTS = process.env.CH_MAX_POSTS ?? "50";

function run(label, args, opts = {}) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 900_000, ...opts });
  const tail = (r.stdout || "").trim().split("\n").slice(-8).join(" | ");
  const errTail = (r.stderr || "").trim().split("\n").slice(-4).join(" | ");
  return { label, ok: r.status === 0, status: r.status, tail, errTail };
}

// 1. scrape + direct Supabase upsert (inside the scraper)
const scrape = run("scrape", ["scripts/scrape-contests.mjs"], { env: { ...process.env, CH_MAX_POSTS: MAX_POSTS } });
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

// compact final summary
let total = 0, scrapedAt = null, dbLine = "n/a";
try {
  const d = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  total = d.total; scrapedAt = d.scraped_at;
} catch { /* ignore */ }
try {
  const lastOut = (scrape.tail || "");
  const m = lastOut.match(/"supabase":\s*\{[^}]*\}/);
  if (m) dbLine = m[0];
} catch { /* ignore */ }
console.log(`SUMMARY: total=${total} scraped_at=${scrapedAt} scrape=${scrape.ok ? "ok" : "FAIL"} supabase=${dbLine} sync=${synced}`);
