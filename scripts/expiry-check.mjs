#!/usr/bin/env node
// Daily expiry check: marks contests past their deadline as expired.
// Runs via Hermes cron. Reads .env for Supabase credentials.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env manually
const envPath = resolve(root, '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k]) => k)
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/;
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

async function main() {
  console.log(`[expiry-check] Starting — today is ${todayStr}`);

  // Fetch all non-expired contests
  const { data: contests, error } = await supabase
    .from('contests')
    .select('id, deadline')
    .eq('is_expired', false);

  if (error) {
    console.error('ERROR: Could not fetch contests:', error.message);
    process.exit(1);
  }

  if (!contests || contests.length === 0) {
    console.log('[expiry-check] No contests to check.');
    return;
  }

  let expired = 0;
  let undated = 0;

  for (const contest of contests) {
    if (!contest.deadline) { undated++; continue; }
    const match = contest.deadline.match(ISO_DATE);
    if (!match) { undated++; continue; }
    const [, y, m, d] = match;
    const deadlineStr = `${y}-${m}-${d}`;
    if (deadlineStr < todayStr) {
      const { error: updateError } = await supabase
        .from('contests')
        .update({ is_expired: true })
        .eq('id', contest.id);
      if (updateError) {
        console.error(`  ERROR updating ${contest.id}:`, updateError.message);
      } else {
        expired++;
      }
    }
  }

  console.log(`[expiry-check] Done — ${expired} expired, ${undated} undated, ${contests.length - expired - undated} still open`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});