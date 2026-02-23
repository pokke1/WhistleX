begin;

drop view if exists public.vendor_rating_stats;
drop view if exists public.pool_vote_stats;

create view public.pool_vote_stats as
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

create view public.vendor_rating_stats as
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

commit;
