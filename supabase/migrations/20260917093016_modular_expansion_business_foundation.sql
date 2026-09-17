alter table public.organization_settings
  add column if not exists business_email text,
  add column if not exists business_phone text,
  add column if not exists business_document text,
  add column if not exists business_address text,
  add column if not exists document_footer text,
  add column if not exists logo_path text;

alter table public.orders add column if not exists balance_due_at timestamptz;

create table if not exists public.quote_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  status text not null check (status in ('draft','sent','approved','rejected','cancelled','converted')),
  notes text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists quote_status_history_quote_idx on public.quote_status_history(quote_id, changed_at desc);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in ('quote','receipt','work_order')),
  source_type text not null check (source_type in ('quote','order','payment')),
  source_id uuid not null,
  storage_path text,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists generated_documents_org_idx on public.generated_documents(organization_id, created_at desc);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  provider_message_id text,
  related_type text,
  related_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_org_status_idx on public.email_outbox(organization_id, status, created_at desc);

create table if not exists public.client_mutations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mutation_id uuid not null,
  mutation_type text not null check (mutation_type in ('quote_create','order_create','production_update','order_notes')),
  payload jsonb not null,
  base_updated_at timestamptz,
  client_created_at timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('applied','conflict','failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, mutation_id)
);
create index if not exists client_mutations_org_idx on public.client_mutations(organization_id, created_at desc);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mutation_id uuid not null,
  mutation_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null,
  base_updated_at timestamptz,
  server_updated_at timestamptz,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (organization_id, mutation_id)
);
create index if not exists sync_conflicts_org_status_idx on public.sync_conflicts(organization_id, status, created_at desc);

alter table public.quote_status_history enable row level security;
alter table public.generated_documents enable row level security;
alter table public.email_outbox enable row level security;
alter table public.client_mutations enable row level security;
alter table public.sync_conflicts enable row level security;

create policy quote_status_history_read on public.quote_status_history for select to authenticated using (organization_id in (select private.user_org_ids()));
create policy quote_status_history_insert on public.quote_status_history for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy generated_documents_read on public.generated_documents for select to authenticated using (organization_id in (select private.user_org_ids()));
create policy generated_documents_insert on public.generated_documents for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin','operator']) and created_by=(select auth.uid()));
create policy generated_documents_update on public.generated_documents for update to authenticated using (private.has_org_role(organization_id,array['owner','admin','operator'])) with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy email_outbox_read on public.email_outbox for select to authenticated using (private.has_org_role(organization_id,array['owner','admin']));
create policy email_outbox_insert on public.email_outbox for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin']) and created_by=(select auth.uid()));
create policy email_outbox_update on public.email_outbox for update to authenticated using (private.has_org_role(organization_id,array['owner','admin'])) with check (private.has_org_role(organization_id,array['owner','admin']));
create policy client_mutations_read on public.client_mutations for select to authenticated using (organization_id in (select private.user_org_ids()) and user_id=(select auth.uid()));
create policy sync_conflicts_read on public.sync_conflicts for select to authenticated using (organization_id in (select private.user_org_ids()));
create policy sync_conflicts_update on public.sync_conflicts for update to authenticated using (private.has_org_role(organization_id,array['owner','admin','operator'])) with check (private.has_org_role(organization_id,array['owner','admin','operator']));

grant select,insert on public.quote_status_history to authenticated;
grant select,insert,update on public.generated_documents to authenticated;
grant select,insert,update on public.email_outbox to authenticated;
grant select on public.client_mutations to authenticated;
grant select,update on public.sync_conflicts to authenticated;
revoke all on public.quote_status_history,public.generated_documents,public.email_outbox,public.client_mutations,public.sync_conflicts from anon;

create or replace function private.log_quote_status_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.quote_status_history(organization_id,quote_id,status,changed_by)
    values(new.organization_id,new.id,new.status,(select auth.uid()));
  end if;
  return new;
end $$;
revoke all on function private.log_quote_status_change() from public;
drop trigger if exists quote_status_history_trigger on public.quotes;
create trigger quote_status_history_trigger after insert or update of status on public.quotes for each row execute function private.log_quote_status_change();

insert into public.quote_status_history(organization_id,quote_id,status,changed_by,changed_at)
select q.organization_id,q.id,q.status,q.created_by,q.created_at from public.quotes q
where not exists(select 1 from public.quote_status_history h where h.quote_id=q.id);

create or replace function private.save_production_stage_impl(p_stage_id uuid,p_organization_id uuid,p_name text,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_name text:=btrim(coalesce(p_name,'')); v_pos int;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.has_org_role(p_organization_id,array['owner','admin']) then raise exception 'Forbidden'; end if;
  if char_length(v_name)<1 or char_length(v_name)>80 then raise exception 'Invalid stage name'; end if;
  if p_stage_id is null then
    select coalesce(max(position),0)+1 into v_pos from public.production_stages where organization_id=p_organization_id;
    insert into public.production_stages(organization_id,name,position,active) values(p_organization_id,v_name,v_pos,coalesce(p_active,true)) returning id into v_id;
  else
    update public.production_stages set name=v_name,active=coalesce(p_active,true),updated_at=now() where id=p_stage_id and organization_id=p_organization_id returning id into v_id;
    if v_id is null then raise exception 'Production stage not found'; end if;
  end if;
  return v_id;
end $$;
create or replace function public.save_production_stage(p_stage_id uuid,p_organization_id uuid,p_name text,p_active boolean default true)
returns uuid language sql set search_path='' as $$ select private.save_production_stage_impl(p_stage_id,p_organization_id,p_name,p_active) $$;

create or replace function private.move_production_stage_impl(p_stage_id uuid,p_direction int)
returns void language plpgsql security definer set search_path='' as $$
declare s public.production_stages%rowtype; other public.production_stages%rowtype; tmp int;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_direction not in (-1,1) then raise exception 'Invalid direction'; end if;
  select * into s from public.production_stages where id=p_stage_id for update;
  if not found then raise exception 'Production stage not found'; end if;
  if not private.has_org_role(s.organization_id,array['owner','admin']) then raise exception 'Forbidden'; end if;
  select * into other from public.production_stages where organization_id=s.organization_id and position=s.position+p_direction for update;
  if not found then return; end if;
  select coalesce(max(position),0)+1000 into tmp from public.production_stages where organization_id=s.organization_id;
  update public.production_stages set position=tmp,updated_at=now() where id=s.id;
  update public.production_stages set position=s.position,updated_at=now() where id=other.id;
  update public.production_stages set position=other.position,updated_at=now() where id=s.id;
end $$;
create or replace function public.move_production_stage(p_stage_id uuid,p_direction int) returns void language sql set search_path='' as $$ select private.move_production_stage_impl(p_stage_id,p_direction) $$;

create or replace function private.delete_production_stage_impl(p_stage_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.production_stages%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into s from public.production_stages where id=p_stage_id for update;
  if not found then raise exception 'Production stage not found'; end if;
  if not private.has_org_role(s.organization_id,array['owner','admin']) then raise exception 'Forbidden'; end if;
  if exists(select 1 from public.order_production where stage_id=s.id) or exists(select 1 from public.production_stage_history where stage_id=s.id) then raise exception 'Stage is referenced by production history and can only be deactivated'; end if;
  delete from public.production_stages where id=s.id;
  with ranked as (select id,row_number() over(order by position,id) as pos from public.production_stages where organization_id=s.organization_id)
  update public.production_stages p set position=ranked.pos,updated_at=now() from ranked where p.id=ranked.id;
end $$;
create or replace function public.delete_production_stage(p_stage_id uuid) returns void language sql set search_path='' as $$ select private.delete_production_stage_impl(p_stage_id) $$;

create or replace function private.set_order_balance_due_impl(p_order_id uuid,p_due_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select organization_id into v_org from public.orders where id=p_order_id;
  if v_org is null then raise exception 'Order not found'; end if;
  if not private.has_org_role(v_org,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
  update public.orders set balance_due_at=p_due_at,updated_at=now() where id=p_order_id;
end $$;
create or replace function public.set_order_balance_due(p_order_id uuid,p_due_at timestamptz) returns void language sql set search_path='' as $$ select private.set_order_balance_due_impl(p_order_id,p_due_at) $$;

revoke all on function public.save_production_stage(uuid,uuid,text,boolean) from public;
revoke all on function public.move_production_stage(uuid,int) from public;
revoke all on function public.delete_production_stage(uuid) from public;
revoke all on function public.set_order_balance_due(uuid,timestamptz) from public;
grant execute on function public.save_production_stage(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.move_production_stage(uuid,int) to authenticated;
grant execute on function public.delete_production_stage(uuid) to authenticated;
grant execute on function public.set_order_balance_due(uuid,timestamptz) to authenticated;
