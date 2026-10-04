-- Extend the existing member product ledger; no parallel ownership catalog.
alter table public.grooming_products
  drop constraint grooming_products_relation_check,
  add constraint grooming_products_relation_check check(relation in
    ('owned','tried','favorite','stopped','saved','in_use','running_low','finished')),
  add column catalog_product_id text check(catalog_product_id ~ '^gid://shopify/Product/[0-9]+$'),
  add column version integer not null default 1 check(version > 0),
  add column updated_at timestamptz not null default now(),
  add column ritual_id uuid,
  add constraint cabinet_ritual_owner foreign key(person_id,ritual_id)
    references public.grooming_rituals(person_id,id) on delete set null (ritual_id),
  add constraint cabinet_catalog_once unique(person_id,catalog_product_id);
create index cabinet_owner_recent on public.grooming_products(person_id,created_at desc,id desc);

create function public.cabinet_record_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.version := 1;
    new.created_at := now();
  else
    if new.person_id is distinct from old.person_id
      or new.id is distinct from old.id
      or new.catalog_product_id is distinct from old.catalog_product_id then
      raise exception 'Product identity is immutable';
    end if;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.cabinet_record_version() from public,anon,authenticated;
create trigger cabinet_record_version before insert or update on public.grooming_products
  for each row execute function public.cabinet_record_version();

-- Keep existing select/insert ownership policies. Explicitly add narrow mutation grants.
grant update(relation,note,ritual_id) on public.grooming_products to authenticated;
grant delete on public.grooming_products to authenticated;
create policy cabinet_owner_update on public.grooming_products for update to authenticated
  using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())))
  with check(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
create policy cabinet_owner_delete on public.grooming_products for delete to authenticated
  using(person_id in(select id from public.persons where auth_user_id=(select auth.uid())));
