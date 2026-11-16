-- APPLIED as migration 20261105042730_company_return_documents. Retained proposal; do not rerun.
-- Additive schema: no existing tables or application records are modified.
begin;
create table public.company_return_documents (
  pharmacy_id uuid primary key references public.pharmacies(id),
  data jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint return_document_shape check (
    jsonb_typeof(data) = 'object'
    and data ?& array['version', 'reports', 'activeId']
    and data->'version' = '1'::jsonb
    and jsonb_typeof(data->'reports') = 'array'
    and data ? 'activeId'
  )
);
alter table public.company_return_documents enable row level security;
revoke all on public.company_return_documents from public, anon, authenticated;
grant select, insert, update on public.company_return_documents to authenticated;
create policy returns_select_pharmacy on public.company_return_documents
  for select to authenticated using (pharmacy_id = (select private.my_pharmacy_id()));
create policy returns_insert_pharmacy on public.company_return_documents
  for insert to authenticated with check (pharmacy_id = (select private.my_pharmacy_id()) and revision = 1);
create policy returns_update_pharmacy on public.company_return_documents
  for update to authenticated
  using (pharmacy_id = (select private.my_pharmacy_id()))
  with check (pharmacy_id = (select private.my_pharmacy_id()));

create function public.check_return_document_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.pharmacy_id <> old.pharmacy_id or new.revision <> old.revision + 1 then
    raise exception 'Invalid return document revision';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.check_return_document_revision() from public, anon, authenticated;
create trigger return_document_revision before update on public.company_return_documents
  for each row execute function public.check_return_document_revision();
commit;
