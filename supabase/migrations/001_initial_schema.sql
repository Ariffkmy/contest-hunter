create extension if not exists pgcrypto;

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  handle text not null,
  prize text not null,
  prompt text not null,
  caption text not null,
  deadline date,
  instagram_url text not null,
  source_post_id text unique,
  image_url text,
  effort text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  scraped_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#15616d'
);

create table if not exists public.contest_tags (
  contest_id uuid references public.contests(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (contest_id, tag_id)
);

create table if not exists public.answer_drafts (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references public.contests(id) on delete cascade,
  tone text not null,
  personal_angle text not null,
  answer text not null,
  model text,
  created_at timestamptz not null default now()
);

alter table public.contests enable row level security;
alter table public.tags enable row level security;
alter table public.contest_tags enable row level security;
alter table public.answer_drafts enable row level security;
