alter table public.contributions add column if not exists txhash text;
alter table public.contributions add column if not exists blocknumber bigint;
alter table public.contributions add column if not exists logindex integer;
