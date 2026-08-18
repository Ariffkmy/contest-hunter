-- Contest expiry.
--
-- The scraper's `raw_status` says what a post looked like when it was last
-- scraped; it goes stale the moment a deadline passes without a re-scrape.
-- `is_expired` is the derived, time-sensitive answer, recomputed daily by the
-- expire-contests edge function from the same YYYY-MM-DD rule the UI uses
-- (src/services/deadlines.js). Storing it rather than computing it per query
-- keeps the filter indexable — `deadline` is free text and unparseable in SQL.
--
-- One deliberate omission: contests_read is left as `using (true)`. Filtering
-- expired rows in the policy would make them unreachable to every future admin
-- surface that goes through the anon key, and RLS is the wrong place for a
-- product default that callers legitimately want to opt out of. The dashboard
-- query filters instead (see src/services/contestsRepo.js), so admin tooling
-- can still read the full catalogue.

alter table public.contests
  add column if not exists is_expired boolean not null default false;

-- Partial index: the dashboard asks for `is_expired = false`, which Postgres
-- can answer by anti-joining this much smaller set. Expired rows are the
-- growing minority over time, so indexing only them stays cheap.
create index if not exists contests_expired_idx
  on public.contests (is_expired)
  where is_expired = true;

-- 001 already granted table-wide SELECT on public.contests to authenticated, so
-- new columns are readable without this. Stated explicitly anyway: it documents
-- the intent and is a no-op if the table-wide grant is ever narrowed.
grant select (is_expired) on public.contests to authenticated;

-- Backfill is left to the first run of the expire-contests function rather than
-- done here in SQL: the parse rule lives in one place (TypeScript), and doing it
-- twice in two languages is how the two drift apart.
