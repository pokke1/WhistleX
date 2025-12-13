create table if not exists pools (
  id text primary key,
  investigator text not null,
  threshold text not null,
  mincontributionfordecrypt text not null,
  factoryaddress text,
  policyid text,
  deadline text,
  ciphertext text
);

create table if not exists contributions (
  id text primary key,
  contributor text not null,
  amount text not null,
  poolid text references pools(id)
);

create table if not exists intel_blobs (
  id uuid default uuid_generate_v4() primary key,
  poolid text references pools(id),
  ciphertext text not null,
  messagekit text not null
);
