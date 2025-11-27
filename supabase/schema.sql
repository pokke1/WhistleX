create table if not exists pools (
  id text primary key,
  investigator text not null,
  threshold text not null,
  minContributionForDecrypt text not null,
  factoryAddress text,
  policyId text,
  deadline text,
  ciphertext text
);

create table if not exists contributions (
  id text primary key,
  contributor text not null,
  amount text not null,
  poolId text references pools(id)
);

create table if not exists intel_blobs (
  id uuid default uuid_generate_v4() primary key,
  poolId text references pools(id),
  ciphertext text not null,
  messageKit text not null
);
