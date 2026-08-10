-- Admin console support.
--
-- Two additions, and one deliberate omission:
--
--   profiles.is_admin  — the flag the admin edge function checks.
--   login_events       — sign-in history with device, because auth.sessions only
--                        holds live sessions and auth.audit_log_entries is empty.
--
-- The omission: no admin RLS policy anywhere. Widening the owner-only policies
-- to "or is_admin" would mean every admin session carries the ability to read
-- every row through the browser's anon key, and a mistake in one policy leaks
-- the whole table. Instead admin reads go through the admin-users function
-- under the service role, which checks the flag once, server-side.

-- ---------------------------------------------------------------------------
-- profiles.is_admin
--
-- Safe to add to a table users can update: 001 grants UPDATE column-by-column
-- (full_name, default_tone, personal_note), so `authenticated` has no privilege
-- on this column and cannot promote itself. Granting it is a manual SQL step.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- login_events
--
-- Written only by the record-login function under the service role. The client
-- cannot insert: a user-supplied device string would be worthless as an audit
-- trail, so the row is built from request headers the caller does not control.
-- ---------------------------------------------------------------------------

create table if not exists public.login_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  user_agent  text,
  ip          text,
  provider    text
);

create index if not exists login_events_user_idx
  on public.login_events (user_id, occurred_at desc);

alter table public.login_events enable row level security;

-- Users can see their own sign-in history; admins read everyone's through the
-- function, not through this policy.
drop policy if exists login_events_select_own on public.login_events;
create policy login_events_select_own on public.login_events
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.login_events from anon, authenticated;
grant select on public.login_events to authenticated;
