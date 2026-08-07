-- Contest Hunter — full schema.
--
-- Shape of the product: `contests` is a shared, read-only catalog produced by
-- the scraper. Everything a signed-in user does to a contest (tracking it,
-- moving it through the workflow, saving drafts) lives in per-user tables keyed
-- on auth.uid(). No user-owned row is reachable without a session.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared catalog
-- ---------------------------------------------------------------------------

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),

  -- post_url is the natural key: a re-scrape upserts on it.
  post_url      text not null unique,
  brand         text not null,
  username      text not null,
  profile_url   text,

  caption       text not null default '',
  prize         text not null,
  prompt        text not null default '',
  conditions    text[] not null default '{}',
  contest_type  text,
  note          text,

  -- Deliberately text, not date: the scraper yields human strings like
  -- "2026-08-02 (winners 6 Aug)" and "End Aug 2026" that do not parse.
  deadline      text,
  posted_at     text,

  likes         integer not null default 0,
  comments      integer not null default 0,

  -- What the scraper saw: teaser | active | expired | winners. The user's own
  -- workflow status lives in user_contests, not here.
  raw_status    text,

  source        text,
  scraped_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists contests_scraped_at_idx on public.contests (scraped_at desc);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,

  -- Defaults for the answer generator, previously hardcoded in the UI.
  default_tone  text not null default 'Warm'
                check (default_tone in ('Warm', 'Funny', 'Premium', 'Bold')),
  personal_note text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One row per user, created at signup and thereafter owned by the Stripe
-- webhook. `plan` is the single value the app gates on.
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  plan                   text not null default 'free' check (plan in ('free', 'pro')),
  status                 text not null default 'inactive',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Per-user state
-- ---------------------------------------------------------------------------

-- A row here means "this user is tracking this contest". Contests the user has
-- not touched are still visible in the catalog; the UI derives their status
-- from contests.raw_status until the user takes an action.
create table if not exists public.user_contests (
  user_id    uuid not null references auth.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  status     text not null default 'in_progress'
             check (status in ('upcoming', 'in_progress', 'completed')),
  saved      boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, contest_id)
);

create index if not exists user_contests_user_idx on public.user_contests (user_id);

create table if not exists public.answer_drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  contest_id     uuid not null references public.contests(id) on delete cascade,
  tone           text not null,
  personal_angle text not null default '',
  answer         text not null,
  model          text,
  created_at     timestamptz not null default now()
);

create index if not exists answer_drafts_user_idx on public.answer_drafts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contests_set_updated_at on public.contests;
create trigger contests_set_updated_at before update on public.contests
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists user_contests_set_updated_at on public.user_contests;
create trigger user_contests_set_updated_at before update on public.user_contests
  for each row execute function public.touch_updated_at();

-- Provision a profile and a free-plan row the moment a user signs up, for both
-- password and OAuth signups. security definer because auth.users inserts run
-- as the auth admin, not as the new user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Plan limits
--
-- Enforced in the database, not just the UI: the client holds a real Postgres
-- session, so a UI-only check is advisory at best.
-- ---------------------------------------------------------------------------

create or replace function public.free_plan_contest_limit()
returns integer language sql immutable set search_path = '' as $$
  select 5;
$$;

create or replace function public.enforce_tracking_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_plan text;
  tracked integer;
begin
  select plan into current_plan from public.subscriptions where user_id = new.user_id;
  if coalesce(current_plan, 'free') <> 'free' then
    return new;
  end if;

  select count(*) into tracked from public.user_contests where user_id = new.user_id;
  if tracked >= public.free_plan_contest_limit() then
    raise exception 'FREE_PLAN_LIMIT: the free plan tracks up to % contests',
      public.free_plan_contest_limit()
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists user_contests_enforce_limit on public.user_contests;
create trigger user_contests_enforce_limit before insert on public.user_contests
  for each row execute function public.enforce_tracking_limit();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- The catalog is readable by any signed-in user and writable only by the
-- service role (the scraper/seed job). Everything else is owner-only, matched
-- on auth.uid(). Note there are no anon policies at all: this app requires a
-- session, so an unauthenticated key reaches nothing.
-- ---------------------------------------------------------------------------

alter table public.contests      enable row level security;
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_contests enable row level security;
alter table public.answer_drafts enable row level security;

drop policy if exists contests_read on public.contests;
create policy contests_read on public.contests
  for select to authenticated using (true);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Read-only to the user: plan changes come from the Stripe webhook running as
-- the service role. A user must not be able to promote themselves to pro.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_contests_all_own on public.user_contests;
create policy user_contests_all_own on public.user_contests
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists answer_drafts_all_own on public.answer_drafts;
create policy answer_drafts_all_own on public.answer_drafts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Narrow the API roles' table privileges to match the policies above.
revoke all on public.contests, public.profiles, public.subscriptions,
              public.user_contests, public.answer_drafts
  from anon, authenticated;

grant select on public.contests to authenticated;
grant select, update (full_name, default_tone, personal_note) on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.user_contests to authenticated;
grant select, insert, delete on public.answer_drafts to authenticated;

-- PostgREST exposes every function in `public` as an RPC endpoint. These are
-- trigger bodies, not API surface, and two of them are SECURITY DEFINER — so
-- take EXECUTE away from the API roles.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.enforce_tracking_limit() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
revoke execute on function public.free_plan_contest_limit() from anon, public;
