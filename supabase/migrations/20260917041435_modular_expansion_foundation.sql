create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enable_3d boolean not null default false,
  low_filament_threshold_g numeric(12,2) not null default 250 check (low_filament_threshold_g >= 0),
  stalled_stage_hours integer not null default 72 check (stalled_stage_hours >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected','cancelled','converted')),
  valid_until date,
  delivery_due_at timestamptz,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  shipping numeric(14,2) not null default 0 check (shipping >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  converted_order_id uuid unique references public.orders(id) on delete set null,
  approved_at timestamptz,
  converted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.customer_product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id, product_id)
);

create table public.production_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  position integer not null check (position >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, position)
);

create table public.order_production (
  order_id uuid primary key references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid references public.production_stages(id) on delete restrict,
  planned_start timestamptz,
  planned_finish timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  responsible_user_id uuid references auth.users(id) on delete set null,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_finish is null or planned_start is null or planned_finish >= planned_start)
);

create table public.production_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  stage_id uuid references public.production_stages(id) on delete restrict,
  stage_name_snapshot text not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  notes text,
  check (exited_at is null or exited_at >= entered_at)
);

create table public.order_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  category text not null check (category in ('material','packaging','shipping','fees','labor','other')),
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  occurred_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('quote','order','payment','customer','product')),
  entity_id uuid not null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id text,
  dedupe_key text not null,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info','warning','danger','success')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);

create table public.filament_rolls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  material text not null,
  color text not null,
  brand text,
  initial_weight_g numeric(12,2) not null check (initial_weight_g > 0),
  remaining_weight_g numeric(12,2) not null check (remaining_weight_g >= 0 and remaining_weight_g <= initial_weight_g),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  acquired_on date,
  status text not null default 'active' check (status in ('active','empty','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.filament_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  roll_id uuid not null references public.filament_rolls(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  movement_type text not null check (movement_type in ('consume','adjust_add','adjust_remove')),
  quantity_g numeric(12,2) not null check (quantity_g > 0),
  balance_after_g numeric(12,2) not null check (balance_after_g >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.order_3d_details (
  order_id uuid primary key references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  model_reference text,
  material text,
  color text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  finishing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_org_status_idx on public.quotes(organization_id,status,created_at desc);
create index quote_items_quote_idx on public.quote_items(quote_id);
create index cpp_org_customer_idx on public.customer_product_prices(organization_id,customer_id);
create index production_stage_org_idx on public.production_stages(organization_id,active,position);
create index order_production_org_stage_idx on public.order_production(organization_id,stage_id,planned_finish);
create index stage_history_order_idx on public.production_stage_history(order_id,entered_at desc);
create index order_costs_order_idx on public.order_costs(order_id,occurred_on desc);
create index attachments_entity_idx on public.attachments(organization_id,entity_type,entity_id);
create index notifications_org_unread_idx on public.notifications(organization_id,read_at,created_at desc);
create index filament_rolls_org_idx on public.filament_rolls(organization_id,status);
create index filament_movements_roll_idx on public.filament_movements(roll_id,created_at desc);

insert into public.organization_settings(organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

insert into public.production_stages(organization_id,name,position)
select o.id, s.name, s.position
from public.organizations o
cross join (values
 ('Aguardando pagamento',1),('Na fila',2),('Em produção',3),('Acabamento',4),('Pronto',5),('Enviado/Retirada',6),('Entregue',7)
) as s(name,position)
on conflict (organization_id,position) do nothing;

alter table public.organization_settings enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.customer_product_prices enable row level security;
alter table public.production_stages enable row level security;
alter table public.order_production enable row level security;
alter table public.production_stage_history enable row level security;
alter table public.order_costs enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.filament_rolls enable row level security;
alter table public.filament_movements enable row level security;
alter table public.order_3d_details enable row level security;

do $$ declare t text; begin
 foreach t in array array['organization_settings','quotes','quote_items','customer_product_prices','production_stages','order_production','production_stage_history','attachments','notifications','filament_rolls','filament_movements','order_3d_details'] loop
  execute format('create policy %I on public.%I for select to authenticated using (organization_id in (select private.user_org_ids()))', t||'_read', t);
 end loop;
end $$;

create policy organization_settings_write on public.organization_settings for update to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']))
 with check (private.has_org_role(organization_id,array['owner','admin']));
create policy quotes_insert on public.quotes for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']) and created_by=(select auth.uid()));
create policy quotes_update on public.quotes for update to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']))
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy quotes_delete on public.quotes for delete to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']) and status in ('draft','rejected','cancelled'));
create policy quote_items_insert on public.quote_items for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy quote_items_update on public.quote_items for update to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']))
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy quote_items_delete on public.quote_items for delete to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy cpp_insert on public.customer_product_prices for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy cpp_update on public.customer_product_prices for update to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']))
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy cpp_delete on public.customer_product_prices for delete to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy production_stages_write on public.production_stages for all to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']))
 with check (private.has_org_role(organization_id,array['owner','admin']));
create policy order_production_write on public.order_production for all to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']))
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy production_history_insert on public.production_stage_history for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy order_costs_read on public.order_costs for select to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']));
create policy order_costs_insert on public.order_costs for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin']) and created_by=(select auth.uid()));
create policy order_costs_update on public.order_costs for update to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']))
 with check (private.has_org_role(organization_id,array['owner','admin']));
create policy order_costs_delete on public.order_costs for delete to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']));
create policy attachments_insert on public.attachments for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']) and uploaded_by=(select auth.uid()));
create policy attachments_delete on public.attachments for delete to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy notifications_insert on public.notifications for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy notifications_update on public.notifications for update to authenticated
 using (organization_id in (select private.user_org_ids()))
 with check (organization_id in (select private.user_org_ids()));
create policy notifications_delete on public.notifications for delete to authenticated
 using (private.has_org_role(organization_id,array['owner','admin']));
create policy filament_rolls_write on public.filament_rolls for all to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']))
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy filament_movements_insert on public.filament_movements for insert to authenticated
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy order_3d_details_write on public.order_3d_details for all to authenticated
 using (private.has_org_role(organization_id,array['owner','admin','operator']))
 with check (private.has_org_role(organization_id,array['owner','admin','operator']));

grant select,insert,update,delete on public.organization_settings,public.quotes,public.quote_items,public.customer_product_prices,public.production_stages,public.order_production,public.production_stage_history,public.order_costs,public.attachments,public.notifications,public.filament_rolls,public.filament_movements,public.order_3d_details to authenticated;
revoke all on public.organization_settings,public.quotes,public.quote_items,public.customer_product_prices,public.production_stages,public.order_production,public.production_stage_history,public.order_costs,public.attachments,public.notifications,public.filament_rolls,public.filament_movements,public.order_3d_details from anon;

create or replace function private.ensure_default_production_stages_impl(p_org uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not private.has_org_role(p_org,array['owner','admin']) then raise exception 'Forbidden'; end if;
 insert into public.organization_settings(organization_id) values(p_org) on conflict do nothing;
 insert into public.production_stages(organization_id,name,position)
 select p_org,s.name,s.position from (values
  ('Aguardando pagamento',1),('Na fila',2),('Em produção',3),('Acabamento',4),('Pronto',5),('Enviado/Retirada',6),('Entregue',7)
 ) s(name,position)
 on conflict (organization_id,position) do nothing;
end $$;
create or replace function public.ensure_default_production_stages(p_organization_id uuid)
returns void language sql set search_path='' as $$ select private.ensure_default_production_stages_impl(p_organization_id) $$;

create or replace function private.create_quote_impl(p_organization_id uuid,p_store_id uuid,p_customer_id uuid,p_valid_until date,p_delivery_due_at timestamptz,p_shipping numeric,p_discount numeric,p_notes text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_quote uuid:=gen_random_uuid(); v_sub numeric(14,2):=0; v_total numeric(14,2); v_item jsonb; v_prod public.products%rowtype; v_qty int; v_price numeric(14,2); v_line numeric(14,2);
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not private.has_org_role(p_organization_id,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Quote must have items'; end if;
 if coalesce(p_shipping,0)<0 or coalesce(p_discount,0)<0 then raise exception 'Invalid totals'; end if;
 if p_store_id is not null and not exists(select 1 from public.stores where id=p_store_id and organization_id=p_organization_id) then raise exception 'Invalid store'; end if;
 if p_customer_id is not null and not exists(select 1 from public.customers where id=p_customer_id and organization_id=p_organization_id) then raise exception 'Invalid customer'; end if;
 insert into public.quotes(id,organization_id,store_id,customer_id,valid_until,delivery_due_at,shipping,discount,notes,created_by)
 values(v_quote,p_organization_id,p_store_id,p_customer_id,p_valid_until,p_delivery_due_at,coalesce(p_shipping,0),coalesce(p_discount,0),nullif(trim(p_notes),''),(select auth.uid()));
 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty=(v_item->>'quantity')::int;
  if v_qty is null or v_qty<=0 then raise exception 'Invalid item quantity'; end if;
  select * into v_prod from public.products where id=(v_item->>'product_id')::uuid and organization_id=p_organization_id and active=true;
  if not found then raise exception 'Product not found'; end if;
  v_price=coalesce(nullif(v_item->>'unit_price','')::numeric,v_prod.price);
  if v_price<0 then raise exception 'Invalid item price'; end if;
  v_line=round(v_price*v_qty,2); v_sub=v_sub+v_line;
  insert into public.quote_items(organization_id,quote_id,product_id,sku,name,quantity,unit_price,line_total)
  values(p_organization_id,v_quote,v_prod.id,v_prod.sku,v_prod.name,v_qty,v_price,v_line);
 end loop;
 v_total=greatest(v_sub+coalesce(p_shipping,0)-coalesce(p_discount,0),0);
 update public.quotes set subtotal=v_sub,total=v_total where id=v_quote;
 return v_quote;
end $$;
create or replace function public.create_quote(p_organization_id uuid,p_store_id uuid,p_customer_id uuid,p_valid_until date,p_delivery_due_at timestamptz,p_shipping numeric,p_discount numeric,p_notes text,p_items jsonb)
returns uuid language sql set search_path='' as $$ select private.create_quote_impl(p_organization_id,p_store_id,p_customer_id,p_valid_until,p_delivery_due_at,p_shipping,p_discount,p_notes,p_items) $$;

create or replace function private.set_quote_status_impl(p_quote_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_status not in ('draft','sent','approved','rejected','cancelled') then raise exception 'Invalid quote status'; end if;
 select * into q from public.quotes where id=p_quote_id for update;
 if not found then raise exception 'Quote not found'; end if;
 if not private.has_org_role(q.organization_id,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
 if q.status='converted' then raise exception 'Converted quote is immutable'; end if;
 update public.quotes set status=p_status,approved_at=case when p_status='approved' then coalesce(approved_at,now()) else approved_at end,updated_at=now() where id=p_quote_id;
end $$;
create or replace function public.set_quote_status(p_quote_id uuid,p_status text)
returns void language sql set search_path='' as $$ select private.set_quote_status_impl(p_quote_id,p_status) $$;

create or replace function private.convert_quote_to_order_impl(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; v_order uuid; v_items jsonb;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into q from public.quotes where id=p_quote_id for update;
 if not found then raise exception 'Quote not found'; end if;
 if not private.has_org_role(q.organization_id,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
 if q.converted_order_id is not null then return q.converted_order_id; end if;
 if q.status<>'approved' then raise exception 'Quote must be approved before conversion'; end if;
 select jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity,'unit_price',unit_price) order by created_at,id) into v_items from public.quote_items where quote_id=q.id;
 if v_items is null then raise exception 'Quote has no items'; end if;
 v_order:=private.create_order_impl(q.organization_id,q.store_id,q.customer_id,null,'pending',q.delivery_due_at,now(),q.shipping,q.discount,null,q.notes,v_items);
 update public.quotes set status='converted',converted_order_id=v_order,converted_at=now(),updated_at=now() where id=q.id;
 return v_order;
end $$;
create or replace function public.convert_quote_to_order(p_quote_id uuid)
returns uuid language sql set search_path='' as $$ select private.convert_quote_to_order_impl(p_quote_id) $$;

create or replace function private.upsert_order_production_impl(p_order_id uuid,p_stage_id uuid,p_planned_start timestamptz,p_planned_finish timestamptz,p_estimated_minutes int,p_responsible_user_id uuid,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_old_stage uuid; v_stage_name text;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select organization_id into v_org from public.orders where id=p_order_id;
 if v_org is null then raise exception 'Order not found'; end if;
 if not private.has_org_role(v_org,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
 if p_stage_id is not null then
  select name into v_stage_name from public.production_stages where id=p_stage_id and organization_id=v_org and active=true;
  if v_stage_name is null then raise exception 'Invalid production stage'; end if;
 end if;
 if p_responsible_user_id is not null and not exists(select 1 from public.memberships where organization_id=v_org and user_id=p_responsible_user_id) then raise exception 'Invalid responsible user'; end if;
 select stage_id into v_old_stage from public.order_production where order_id=p_order_id for update;
 insert into public.order_production(order_id,organization_id,stage_id,planned_start,planned_finish,estimated_minutes,responsible_user_id,notes,updated_by)
 values(p_order_id,v_org,p_stage_id,p_planned_start,p_planned_finish,p_estimated_minutes,p_responsible_user_id,nullif(trim(p_notes),''),(select auth.uid()))
 on conflict(order_id) do update set stage_id=excluded.stage_id,planned_start=excluded.planned_start,planned_finish=excluded.planned_finish,estimated_minutes=excluded.estimated_minutes,responsible_user_id=excluded.responsible_user_id,notes=excluded.notes,updated_by=(select auth.uid()),updated_at=now();
 if p_stage_id is distinct from v_old_stage and p_stage_id is not null then
  update public.production_stage_history set exited_at=now() where order_id=p_order_id and exited_at is null;
  insert into public.production_stage_history(organization_id,order_id,stage_id,stage_name_snapshot,changed_by,notes)
  values(v_org,p_order_id,p_stage_id,v_stage_name,(select auth.uid()),nullif(trim(p_notes),''));
 end if;
end $$;
create or replace function public.upsert_order_production(p_order_id uuid,p_stage_id uuid default null,p_planned_start timestamptz default null,p_planned_finish timestamptz default null,p_estimated_minutes int default null,p_responsible_user_id uuid default null,p_notes text default null)
returns void language sql set search_path='' as $$ select private.upsert_order_production_impl(p_order_id,p_stage_id,p_planned_start,p_planned_finish,p_estimated_minutes,p_responsible_user_id,p_notes) $$;

create or replace function private.record_order_cost_impl(p_order_id uuid,p_order_item_id uuid,p_category text,p_amount numeric,p_description text,p_occurred_on date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_id uuid:=gen_random_uuid();
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select organization_id into v_org from public.orders where id=p_order_id;
 if v_org is null then raise exception 'Order not found'; end if;
 if not private.has_org_role(v_org,array['owner','admin']) then raise exception 'Forbidden'; end if;
 if p_category not in ('material','packaging','shipping','fees','labor','other') then raise exception 'Invalid category'; end if;
 if coalesce(p_amount,-1)<0 then raise exception 'Invalid amount'; end if;
 if p_order_item_id is not null and not exists(select 1 from public.order_items where id=p_order_item_id and order_id=p_order_id and organization_id=v_org) then raise exception 'Invalid order item'; end if;
 insert into public.order_costs(id,organization_id,order_id,order_item_id,category,description,amount,occurred_on,created_by)
 values(v_id,v_org,p_order_id,p_order_item_id,p_category,nullif(trim(p_description),''),round(p_amount,2),coalesce(p_occurred_on,current_date),(select auth.uid()));
 return v_id;
end $$;
create or replace function public.record_order_cost(p_order_id uuid,p_order_item_id uuid,p_category text,p_amount numeric,p_description text default null,p_occurred_on date default null)
returns uuid language sql set search_path='' as $$ select private.record_order_cost_impl(p_order_id,p_order_item_id,p_category,p_amount,p_description,p_occurred_on) $$;

create or replace function private.consume_filament_impl(p_roll_id uuid,p_quantity_g numeric,p_order_id uuid,p_order_item_id uuid,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.filament_rolls%rowtype; v_balance numeric(12,2); v_id uuid:=gen_random_uuid();
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into r from public.filament_rolls where id=p_roll_id for update;
 if not found then raise exception 'Filament roll not found'; end if;
 if not private.has_org_role(r.organization_id,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
 if coalesce(p_quantity_g,0)<=0 then raise exception 'Invalid quantity'; end if;
 if p_order_id is not null and not exists(select 1 from public.orders where id=p_order_id and organization_id=r.organization_id) then raise exception 'Invalid order'; end if;
 if p_order_item_id is not null and not exists(select 1 from public.order_items where id=p_order_item_id and organization_id=r.organization_id and (p_order_id is null or order_id=p_order_id)) then raise exception 'Invalid order item'; end if;
 v_balance=round(r.remaining_weight_g-p_quantity_g,2);
 if v_balance<0 then raise exception 'Insufficient filament'; end if;
 update public.filament_rolls set remaining_weight_g=v_balance,status=case when v_balance=0 then 'empty' else status end,updated_at=now() where id=r.id;
 insert into public.filament_movements(id,organization_id,roll_id,order_id,order_item_id,movement_type,quantity_g,balance_after_g,notes,created_by)
 values(v_id,r.organization_id,r.id,p_order_id,p_order_item_id,'consume',round(p_quantity_g,2),v_balance,nullif(trim(p_notes),''),(select auth.uid()));
 return v_id;
end $$;
create or replace function public.consume_filament(p_roll_id uuid,p_quantity_g numeric,p_order_id uuid default null,p_order_item_id uuid default null,p_notes text default null)
returns uuid language sql set search_path='' as $$ select private.consume_filament_impl(p_roll_id,p_quantity_g,p_order_id,p_order_item_id,p_notes) $$;

revoke all on function public.ensure_default_production_stages(uuid) from public;
revoke all on function public.create_quote(uuid,uuid,uuid,date,timestamptz,numeric,numeric,text,jsonb) from public;
revoke all on function public.set_quote_status(uuid,text) from public;
revoke all on function public.convert_quote_to_order(uuid) from public;
revoke all on function public.upsert_order_production(uuid,uuid,timestamptz,timestamptz,int,uuid,text) from public;
revoke all on function public.record_order_cost(uuid,uuid,text,numeric,text,date) from public;
revoke all on function public.consume_filament(uuid,numeric,uuid,uuid,text) from public;
grant execute on function public.ensure_default_production_stages(uuid) to authenticated;
grant execute on function public.create_quote(uuid,uuid,uuid,date,timestamptz,numeric,numeric,text,jsonb) to authenticated;
grant execute on function public.set_quote_status(uuid,text) to authenticated;
grant execute on function public.convert_quote_to_order(uuid) to authenticated;
grant execute on function public.upsert_order_production(uuid,uuid,timestamptz,timestamptz,int,uuid,text) to authenticated;
grant execute on function public.record_order_cost(uuid,uuid,text,numeric,text,date) to authenticated;
grant execute on function public.consume_filament(uuid,numeric,uuid,uuid,text) to authenticated;
