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
with contribution_weights as (
  select
    c.poolid,
    lower(c.contributor) as voteraddress,
    coalesce(sum((c.amount)::numeric), 0) as voteweight
  from public.contributions c
  group by c.poolid, lower(c.contributor)
)
select
  pv.poolid,
  coalesce(sum(case when pv.vote = 1 then 1 else 0 end), 0) as upvotes,
  coalesce(sum(case when pv.vote = -1 then 1 else 0 end), 0) as downvotes,
  coalesce(
    sum((pv.vote::numeric) * coalesce(cw.voteweight, 0)) / nullif(sum(coalesce(cw.voteweight, 0)), 0),
    0
  ) as avgrating,
  coalesce(sum((pv.vote::numeric) * coalesce(cw.voteweight, 0)), 0) as score,
  coalesce(sum(cw.voteweight), 0) as votepower
from public.pool_votes pv
left join contribution_weights cw
  on cw.poolid = pv.poolid
 and cw.voteraddress = lower(pv.voteraddress)
group by pv.poolid;

create or replace view public.vendor_rating_stats as
with contribution_weights as (
  select
    c.poolid,
    lower(c.contributor) as voteraddress,
    coalesce(sum((c.amount)::numeric), 0) as voteweight
  from public.contributions c
  group by c.poolid, lower(c.contributor)
)
select
  p.investigator as vendoraddress,
  count(distinct p.id) as poolcount,
  count(pv.id) as totalvotes,
  coalesce(
    sum((pv.vote::numeric) * coalesce(cw.voteweight, 0)) / nullif(sum(coalesce(cw.voteweight, 0)), 0),
    0
  ) as avgrating,
  coalesce(sum((pv.vote::numeric) * coalesce(cw.voteweight, 0)), 0) as score,
  coalesce(sum(cw.voteweight), 0) as votepower
from public.pools p
left join public.pool_votes pv on pv.poolid = p.id
left join contribution_weights cw
  on cw.poolid = pv.poolid
 and cw.voteraddress = lower(pv.voteraddress)
group by p.investigator;

create table if not exists public.pool_files (
  id uuid primary key default gen_random_uuid(),
  poolid text not null references public.pools(id) on delete cascade,
  path text not null,
  public_url text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_files_poolid on public.pool_files(poolid);

create table if not exists public.pool_state_cache (
  poolid text primary key references public.pools(id) on delete cascade,
  currency text,
  currency_decimals integer,
  total_contributions text,
  threshold text,
  min_contribution_for_decrypt text,
  deadline text,
  unlocked boolean,
  updated_at timestamptz not null default now()
);

create index if not exists idx_pool_state_cache_updated_at on public.pool_state_cache(updated_at);

create table if not exists public.pool_comments (
  id uuid primary key default gen_random_uuid(),
  poolid text not null references public.pools(id) on delete cascade,
  author text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_comments_poolid on public.pool_comments(poolid);

insert into storage.buckets (id, name, public)
values ('pool-attachments', 'pool-attachments', true)
on conflict do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read pool attachments'
  ) then
    execute 'create policy "Public read pool attachments" on storage.objects
      for select using (bucket_id = ''pool-attachments'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public insert pool attachments'
  ) then
    execute 'create policy "Public insert pool attachments" on storage.objects
      for insert with check (bucket_id = ''pool-attachments'')';
  end if;
end $$;
