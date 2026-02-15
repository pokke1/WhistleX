create extension if not exists pgcrypto;

create table if not exists public.pools (
  id text primary key,
  investigator text not null,
  threshold text not null,
  mincontributionfordecrypt text not null,
  title text,
  description text,
  factoryaddress text,
  policyid text,
  deadline text,
  ciphertext text
);

create table if not exists public.contributions (
  id text primary key,
  contributor text not null,
  amount text not null,
  poolid text references public.pools(id),
  txhash text,
  blocknumber bigint,
  logindex integer
);

alter table public.contributions add column if not exists txhash text;
alter table public.contributions add column if not exists blocknumber bigint;
alter table public.contributions add column if not exists logindex integer;

create index if not exists idx_contributions_poolid on public.contributions(poolid);
create index if not exists idx_contributions_contributor on public.contributions(contributor);

create table if not exists public.intel_blobs (
  id uuid default gen_random_uuid() primary key,
  poolid text references public.pools(id),
  ciphertext text not null,
  messagekit text not null,
  created_at timestamptz default now()
);

create index if not exists idx_intel_blobs_poolid on public.intel_blobs(poolid);

create table if not exists public.pool_votes (
  id bigserial primary key,
  poolid text not null references public.pools(id) on delete cascade,
  voteraddress text not null,
  vote smallint not null check (vote in (-1, 1)),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  constraint pool_votes_one_vote_per_pool unique (poolid, voteraddress)
);

create index if not exists idx_pool_votes_poolid on public.pool_votes(poolid);
create index if not exists idx_pool_votes_voteraddress on public.pool_votes(voteraddress);

create table if not exists public.user_profiles (
  address text primary key,
  display_name text,
  bio text,
  avatar_url text,
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

create or replace view public.pool_vote_stats as
select
  pv.poolid,
  count(*) filter (where pv.vote = 1) as upvotes,
  count(*) filter (where pv.vote = -1) as downvotes,
  coalesce(avg(pv.vote::numeric), 0) as avgrating,
  coalesce(sum(pv.vote), 0) as score
from public.pool_votes pv
group by pv.poolid;

create or replace view public.vendor_rating_stats as
select
  p.investigator as vendoraddress,
  count(distinct p.id) as poolcount,
  count(pv.id) as totalvotes,
  coalesce(avg(pv.vote::numeric), 0) as avgrating,
  coalesce(sum(pv.vote), 0) as score
from public.pools p
left join public.pool_votes pv on pv.poolid = p.id
group by p.investigator;
