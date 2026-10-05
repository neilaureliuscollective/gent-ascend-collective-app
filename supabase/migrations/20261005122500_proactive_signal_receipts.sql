-- Ahead receipts remember that a member already handled a derived proactive signal.
-- Candidate signals remain derived from current domain truth; this table is not a second task system.
create table public.proactive_signal_receipts (
  person_id uuid not null references public.persons(id) on delete cascade,
  signal_key text not null check(char_length(signal_key) between 3 and 240),
  disposition text not null check(disposition in ('opened','dismissed')),
  handled_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(person_id,signal_key),
  check(expires_at > handled_at)
);
create index proactive_signal_receipts_expiry
  on public.proactive_signal_receipts(person_id,expires_at desc);

alter table public.proactive_signal_receipts enable row level security;
revoke all on public.proactive_signal_receipts from public,anon,authenticated;
grant select,insert,update(disposition,handled_at,expires_at) on public.proactive_signal_receipts to authenticated;

create policy proactive_receipt_owner_select on public.proactive_signal_receipts
  for select to authenticated
  using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create policy proactive_receipt_owner_insert on public.proactive_signal_receipts
  for insert to authenticated
  with check(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));

create policy proactive_receipt_owner_update on public.proactive_signal_receipts
  for update to authenticated
  using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())))
  with check(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
