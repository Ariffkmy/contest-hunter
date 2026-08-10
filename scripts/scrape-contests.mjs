#!/usr/bin/env node
// Contest Hunter daily scraper — zero-dependency, drives the OpenClaw browser
// over CDP (http://127.0.0.1:18800 by default, override with CH_CDP_URL).
//
//   node scripts/scrape-contests.mjs
//
// Scans Instagram hashtags (giveawaymalaysia + contestmalaysia), opens each
// post, and reads og:title/og:description like the original 2026-08-03 scrape.
// Writes src/data/instagram-giveaways.json in the exact shape the seed script
// and both apps expect. Re-running is safe; post_url is the identity.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { toContestRow } from "../src/services/contestMapper.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const OUT_PATH = resolve(root, "src/data/instagram-giveaways.json");
const CDP_URL = process.env.CH_CDP_URL ?? "http://127.0.0.1:18800";
const HASHTAGS = process.env.CH_HASHTAGS?.split(",") ?? ["giveawaymalaysia", "contestmalaysia"];
const MAX_POSTS = Number(process.env.CH_MAX_POSTS ?? 50);
const NAV_WAIT_MS = Number(process.env.CH_NAV_WAIT_MS ?? 5000);

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
  sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12
};

function parseNumber(raw) {
  if (!raw) return 0;
  const clean = String(raw).replace(/[,\s]/g, "").toLowerCase();
  const m = clean.match(/^([\d.]+)([kmb])?$/);
  if (!m) return 0;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}

function normalizeDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  // "August 1, 2026" / "1 August 2026" / "1 Aug 2026" / "05 AUG 2026" / "2 Aug, 11.59pm"
  let m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const [, a, b, y] = m;
    let day, month, year = Number(y);
    if (year < 100) year += 2000;
    if (Number(a) > 12) { day = Number(a); month = Number(b); }
    else { month = Number(a); day = Number(b); }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)[.,]?\s+(\d{4})/);
  if (m) {
    const [, day, mon, year] = m;
    const month = MONTHS[mon.toLowerCase()];
    if (month) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  m = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[.,]?\s+(\d{4})/);
  if (m) {
    const [, mon, day, year] = m;
    const month = MONTHS[mon.toLowerCase()];
    if (month) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function parseOgDescription(desc) {
  // "103 likes, 70 comments - wctland on August 1, 2026: "caption"."
  const m = String(desc ?? "").match(
    /^([\d.,]+[KMB]?)\s+likes,\s*([\d.,]+[KMB]?)\s+comments\s*-\s*@?([\w.]+)\s+on\s+([^:]+):\s*(.*)$/is
  );
  if (!m) return null;
  const [, likes, comments, username, date, caption] = m;
  return {
    likes: parseNumber(likes),
    comments: parseNumber(comments),
    username: username.replace(/^@/, ""),
    posted_at: date.trim().replace(/\s+/g, " "),
    caption: caption.trim().replace(/^"|"\.?$/g, "").trim()
  };
}

function brandFromTitle(title, caption, username) {
  // og:title is "{Brand} on Instagram: \"...\"" — the most reliable source.
  const t = sanitizeText(title ?? "");
  const m = t.match(/^(.+?)\s+on Instagram:/);
  if (m) {
    const brand = m[1].trim();
    if (brand.length >= 2 && brand.length <= 60) return brand;
  }
  const firstLine = caption.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const stripped = firstLine.replace(/^[#🎉📣✨🎁👀📢🔥🇲🇾🆕]+/g, "").trim();
  if (stripped.length >= 3 && stripped.length <= 60 && !/win|giveaway|contest|peraduan|menang/i.test(stripped)) {
    return stripped.replace(/\s+[—-]\s+.*$/, "").trim();
  }
  return username;
}

function normalizePostUrl(url) {
  const m = String(url ?? "").match(/\/p\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/p/${m[1]}/` : url;
}

function sanitizeText(text) {
  // Lone surrogates are invalid UTF-8 for Postgres — drop them.
  return String(text ?? "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

function extractPrize(caption) {
  const clean = String(caption ?? "");
  const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // 1) Explicit prize lines first: "🎁 Prize:", "Prize includes:", "Prizes:", "Hadiah:"
  const explicit = lines.find((l) => /^(🎁\s*)?(prize|hadiah)s?\s*:?/i.test(l));
  if (explicit) {
    let out = explicit.replace(/^(🎁\s*)?(prize|hadiah)s?\s*:?\s*/i, "").trim();
    out = out.replace(/\s+#\S+/g, "").trim();
    if (out.length > 160) out = out.slice(0, 157).trimEnd() + "…";
    return out || null;
  }
  // 2) Win-phrase capture: after "win/menang/berpeluang/stand a chance to win"
  const m = clean.match(/(?:win(?:ning)?|memenangi|berpeluang|stand a chance to win)[:\s]*([^\n]{5,180})/i);
  if (m) {
    let out = m[1].replace(/\s+#\S+/g, "").trim();
    out = out.replace(/^(?:an?|a|the)\s+/i, "").trim();
    out = out.replace(/[.!?]+\s*$/, "").trim();
    if (out.length > 160) out = out.slice(0, 157).trimEnd() + "…";
    return out || null;
  }
  return null;
}

function extractConditions(caption) {
  const clean = String(caption ?? "");
  const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const conditions = [];
  for (const line of lines) {
    const step = line
      .replace(/^\d+[).]\s*/, "")
      .replace(/^[-•✅✨🎁👣📝💬📱🛒📸🔁\+]\s*/, "")
      .replace(/^step\s*\d+[:\-]?\s*/i, "")
      .trim();
    if (!step) continue;
    if (/^(follow|like|comment|tag|share|repost|story|dm|scan|buy|purchase|beli|isi|fill|upload|post|subscribe|save|turn on)/i.test(step)) {
      if (!conditions.includes(step) && step.length > 8 && step.length < 200) conditions.push(step);
    }
    if (conditions.length >= 6) break;
  }
  return conditions;
}

function extractContestType(caption, conditions) {
  const text = String(caption ?? "").toLowerCase();
  const parts = [];
  if (/comment/.test(text) || /komen/.test(text)) parts.push("comment");
  if (/follow/.test(text)) parts.push("follow");
  if (/tag/.test(text)) parts.push("tag");
  if (/share|repost|story/.test(text)) parts.push("share");
  if (/like/.test(text)) parts.push("like");
  if (/quiz|answer|scan/.test(text)) parts.push("quiz");
  if (/receipt|purchase|beli|buy/.test(text)) parts.push("purchase");
  return parts.join("+") || (conditions.length ? "entry" : null);
}

function extractDeadlines(caption, scrapedAt) {
  const clean = String(caption ?? "");
  const parts = [];
  const datePat = "(?:\\d{1,2}\\s+[A-Za-z]{3,9}[.,]?\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{2,4})";
  // Malay + English close-date phrases
  const close = clean.match(new RegExp(
    "(?:entries?\\s+close|contest\\s+period|giveaway\\s+period|promotion\\s+period|" +
    "giveaway\\s+ends|closing\\s+date|deadline|tarikh\\s+tutup|tempoh\\s+penyertaan|tempoh\\s+peraduan|" +
    "peraduan\\s+dibuka|contest\\s+period)[^.\\n]*?" + datePat, "i"));
  // date range "X – Y 2026" -> take the end date
  const range = clean.match(new RegExp(datePat + "\\s*(?:–|-|to|hingga|sehingga)\\s*" + datePat, "i"));
  if (close) {
    const date = normalizeDate(close[0]);
    if (date) parts.push(date);
  } else if (range) {
    const end = normalizeDate(range[2]);
    if (end) parts.push(end);
  }
  const winners = clean.match(new RegExp(
    "(?:winner[s]?\\s+(?:announcement|announced)|pengumuman\\s+pemenang)[^.\\n]*?" + datePat, "i"));
  let winnersDate = null;
  if (winners) winnersDate = normalizeDate(winners[0]);
  if (parts.length === 0 && winnersDate) parts.push(winnersDate);
  const base = parts[0] ?? null;
  if (base && winnersDate && winnersDate !== base) return `${base} (winners ${winnersDate})`;
  return base;
}

function inferStatus({ deadline, caption, scrapedAt }) {
  const text = String(caption ?? "").toLowerCase();
  const joinSignal = /how to join|cara sertai|cara penyertaan|entries?\s+close|follow\s+@|comment|scan|join now/i.test(text);
  if (deadline) {
    const dateMatch = deadline.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      const d = new Date(dateMatch[0] + "T23:59:59+08:00");
      if (!Number.isNaN(d.getTime()) && d < new Date(scrapedAt)) return "expired";
    }
  }
  // Winner *announcement* posts (EN + BM), not "3 lucky winners" phrasing.
  if (!joinSignal && /congratulations|and the winner is|announcing the winner|tahniah.{0,40}pemenang|pemenang.{0,40}(diumumkan|dipilih)|winner announcement[:\s]+(the|our)?\s*winner/i.test(text)) return "winners";
  if (/coming soon|is coming|teaser|watch this space|stay tuned/i.test(text)) return "teaser";
  return "active";
}

// ---------- CDP plumbing ----------
async function connect() {
  const tabs = await (await fetch(CDP_URL + "/json")).json();
  let page = tabs.find((t) => t.type === "page" && t.url.includes("instagram.com"));
  if (!page) {
    const created = await (await fetch(CDP_URL + "/json/new?url=" + encodeURIComponent("https://www.instagram.com/"), { method: "PUT" })).json();
    page = created;
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const m = ++id; pending.set(m, { res, rej });
    ws.send(JSON.stringify({ id: m, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result?.value;
  };
  const navigate = async (url) => {
    await send("Page.navigate", { url });
    // wait for load + a beat for meta/JS rendering
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const state = await evaluate("document.readyState").catch(() => null);
      if (state === "complete") break;
    }
  };
  return { ws, send, evaluate, navigate };
}

async function collectPostUrls({ evaluate, navigate }) {
  const urls = new Set();
  for (const tag of HASHTAGS) {
    process.stderr.write(`scanning #${tag} ...\n`);
    await navigate(`https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`);
    await new Promise((r) => setTimeout(r, 2500));
    const found = await evaluate(`(() => {
      const links = [...document.querySelectorAll('a[href*="/p/"]')].map(a => a.href);
      return [...new Set(links)];
    })()`).catch(() => []);
    // retry once after scrolling
    if (found.length < 5) {
      await evaluate(`window.scrollTo(0, document.body.scrollHeight)`).catch(() => {});
      await new Promise((r) => setTimeout(r, 2500));
      const more = await evaluate(`(() => {
        const links = [...document.querySelectorAll('a[href*="/p/"]')].map(a => a.href);
        return [...new Set(links)];
      })()`).catch(() => []);
      more.forEach((u) => urls.add(u));
    }
    found.forEach((u) => urls.add(u));
    process.stderr.write(`  -> ${found.length} post links\n`);
  }
  return [...urls].slice(0, MAX_POSTS);
}

async function scrapePost({ navigate, evaluate }, url) {
  await navigate(url);
  await new Promise((r) => setTimeout(r, NAV_WAIT_MS));
  // og:description sometimes lags; retry briefly
  let desc = null;
  for (let i = 0; i < 4 && !desc; i++) {
    desc = await evaluate(`document.querySelector('meta[property="og:description"]')?.content ?? null`).catch(() => null);
    if (!desc) await new Promise((r) => setTimeout(r, 1500));
  }
  const title = await evaluate(`document.querySelector('meta[property="og:title"]')?.content ?? null`).catch(() => null);
  const canonical = await evaluate(`document.querySelector('link[rel="canonical"]')?.href ?? null`).catch(() => null);
  const parsed = parseOgDescription(desc);
  if (!parsed) return null;
  const postUrl = normalizePostUrl(canonical?.includes("/p/") ? canonical : url);
  return { parsed, title, postUrl };
}

// ---------- Supabase direct upsert ----------
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
  } catch { /* no .env, use real env */ }
  return env;
}

async function upsertToSupabase(contests, source, scrapedAtLabel) {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { skipped: true, reason: "no SUPABASE_SERVICE_ROLE_KEY in .env" };
  }
  const rows = contests.map((c) => toContestRow(c, { source, scrapedAt: scrapedAtLabel }));

  // existing post_urls -> count how many are new
  const existing = new Set();
  try {
    let all = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(`${url}/rest/v1/contests?select=post_url&order=post_url&offset=${from}&limit=1000`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      if (!r.ok) break;
      const batch = await r.json();
      if (!batch.length) break;
      batch.forEach((b) => existing.add(b.post_url));
      if (batch.length < 1000) break;
    }
  } catch { /* non-fatal */ }

  const res = await fetch(`${url}/rest/v1/contests?on_conflict=post_url`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    return { skipped: false, ok: false, error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  const added = rows.filter((r) => !existing.has(r.post_url)).length;
  const updated = rows.length - added;
  return { skipped: false, ok: true, total: rows.length, added, updated };
}

// ---------- main ----------
const scrapedAt = new Date();
const scrapedAtLabel = scrapedAt.toISOString().slice(0, 19).replace("T", " ") + "+08:00";
const source = `instagram hashtag:${HASHTAGS.map((h) => "#" + h).join(" + ")} (via browser session @ariffkmy)`;

let previous = { contests: [] };
try {
  previous = JSON.parse(readFileSync(OUT_PATH, "utf8"));
} catch { /* first run */ }
const previousByUrl = new Map(previous.contests.map((c) => [c.post_url, c]));

process.stderr.write(`connecting to browser CDP ...\n`);
const cdp = await connect();
const postUrls = await collectPostUrls(cdp);
process.stderr.write(`scraping ${postUrls.length} posts ...\n`);

const contests = [];
const seen = new Set();
for (const url of postUrls) {
  if (seen.has(url)) continue;
  seen.add(url);
  try {
    const r = await scrapePost(cdp, url);
    if (!r) { process.stderr.write(`  skip (no meta): ${url}\n`); continue; }
    const { parsed, title, postUrl } = r;
    if (!postUrl) continue;
    const prev = previousByUrl.get(postUrl);
    const caption = sanitizeText(parsed.caption || prev?.caption || "");
    const conditions = prev?.conditions?.length ? prev.conditions : extractConditions(caption);
    const deadline = prev?.deadline ?? extractDeadlines(caption, scrapedAt.toISOString());
    const prize = prev?.prize ?? extractPrize(caption);
    const contest_type = prev?.contest_type ?? extractContestType(caption, conditions);
    // status is time-sensitive (expires) — always re-derive from today's date.
    const status = inferStatus({ deadline, caption, scrapedAt: scrapedAt.toISOString() });
    contests.push({
      brand: prev?.brand ?? brandFromTitle(title, caption, parsed.username),
      username: parsed.username,
      profile_url: `https://instagram.com/${parsed.username}`,
      post_url: postUrl,
      caption,
      prize,
      conditions,
      deadline,
      contest_type,
      status,
      note: prev?.note ?? null,
      posted_at: parsed.posted_at,
      engagement: { likes: parsed.likes, comments: parsed.comments }
    });
    process.stderr.write(`  ok: @${parsed.username} (${parsed.likes} likes, ${parsed.comments} comments)\n`);
  } catch (err) {
    process.stderr.write(`  error ${url}: ${err.message}\n`);
  }
}

const out = { scraped_at: scrapedAtLabel, source, total: contests.length, contests };
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

const db = await upsertToSupabase(contests, source, scrapedAtLabel);
if (db.skipped) {
  process.stderr.write(`SUPABASE: skipped (${db.reason})\n`);
} else if (!db.ok) {
  process.stderr.write(`SUPABASE: FAIL ${db.error}\n`);
} else {
  process.stderr.write(`SUPABASE: upserted ${db.total} (${db.added} new, ${db.updated} updated)\n`);
}

cdp.ws.close();
process.stderr.write(`\nDone: ${contests.length} contests -> ${OUT_PATH}\n`);
console.log(JSON.stringify({ total: contests.length, scraped_at: scrapedAtLabel, source, supabase: db }, null, 2));
