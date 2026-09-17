create or replace function private.restore_workspace_backup_impl(
  p_organization_id uuid,
  p_backup jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_source_org uuid;
  v_org_name text;
  v_key text;
  v_keys text[] := array[
    'stores', 'customers', 'products', 'orders', 'order_items',
    'inventory_movements', 'financial_transactions', 'audit_logs', 'team'
  ];
  v_has_data boolean;
  v_team_count integer := 0;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.owner_user_id = v_user
  ) then
    raise exception 'only the organization owner can restore a backup';
  end if;

  if p_backup is null
     or p_backup->>'format' <> 'system-seller-workspace-backup'
     or coalesce((p_backup->>'schema_version')::integer, 0) <> 1
     or jsonb_typeof(p_backup->'organization') <> 'object' then
    raise exception 'invalid or unsupported System Seller backup';
  end if;

  foreach v_key in array v_keys loop
    if jsonb_typeof(p_backup->v_key) <> 'array' then
      raise exception 'invalid backup section: %', v_key;
    end if;
    if jsonb_array_length(p_backup->v_key) > 100000 then
      raise exception 'backup section is too large: %', v_key;
    end if;
  end loop;

  begin
    v_source_org := (p_backup->'organization'->>'id')::uuid;
  exception when others then
    raise exception 'invalid organization identifier in backup';
  end;

  v_org_name := btrim(coalesce(p_backup->'organization'->>'name', ''));
  if char_length(v_org_name) < 2 or char_length(v_org_name) > 120 then
    raise exception 'invalid organization name in backup';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));

  if v_source_org <> p_organization_id then
    if exists (select 1 from public.organizations where id = v_source_org) then
      raise exception 'this backup belongs to an existing organization; select that organization before restoring';
    end if;

    select
      exists (select 1 from public.stores where organization_id = p_organization_id)
      or exists (select 1 from public.customers where organization_id = p_organization_id)
      or exists (select 1 from public.products where organization_id = p_organization_id)
      or exists (select 1 from public.orders where organization_id = p_organization_id)
      or exists (select 1 from public.financial_transactions where organization_id = p_organization_id)
    into v_has_data;

    if v_has_data then
      raise exception 'a backup from another organization can only be restored into an empty organization';
    end if;
  end if;

  delete from public.organization_invites where organization_id = p_organization_id;
  delete from public.financial_transactions where organization_id = p_organization_id;
  delete from public.inventory_movements where organization_id = p_organization_id;
  delete from public.order_items where organization_id = p_organization_id;
  delete from public.orders where organization_id = p_organization_id;
  delete from public.products where organization_id = p_organization_id;
  delete from public.customers where organization_id = p_organization_id;
  delete from public.stores where organization_id = p_organization_id;
  delete from public.memberships
   where organization_id = p_organization_id
     and not (user_id = v_user and role = 'owner');

  update public.organizations
     set name = v_org_name
   where id = p_organization_id;

  insert into public.stores (
    id, organization_id, name, marketplace, external_account_id,
    integration_status, active, created_at, updated_at
  )
  select
    x.id, p_organization_id, x.name, x.marketplace, x.external_account_id,
    x.integration_status, x.active, coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(p_backup->'stores') as x(
    id uuid, organization_id uuid, name text, marketplace text,
    external_account_id text, integration_status text, active boolean,
    created_at timestamptz, updated_at timestamptz
  );

  insert into public.customers (
    id, organization_id, name, email, phone, document, notes, created_at, updated_at
  )
  select
    x.id, p_organization_id, x.name, x.email, x.phone, x.document, x.notes,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(p_backup->'customers') as x(
    id uuid, organization_id uuid, name text, email text, phone text,
    document text, notes text, created_at timestamptz, updated_at timestamptz
  );

  insert into public.products (
    id, organization_id, sku, name, cost, price, stock, min_stock,
    active, created_at, updated_at
  )
  select
    x.id, p_organization_id, x.sku, x.name, x.cost, x.price, x.stock, x.min_stock,
    x.active, coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(p_backup->'products') as x(
    id uuid, organization_id uuid, sku text, name text, cost numeric,
    price numeric, stock integer, min_stock integer, active boolean,
    created_at timestamptz, updated_at timestamptz
  );

  insert into public.orders (
    id, organization_id, store_id, customer_id, external_id, status,
    payment_status, due_at, sold_at, subtotal, shipping, discount, total,
    tracking_code, notes, created_by, created_at, updated_at
  )
  select
    x.id, p_organization_id, x.store_id, x.customer_id, x.external_id, x.status,
    x.payment_status, x.due_at, x.sold_at, x.subtotal, x.shipping, x.discount,
    x.total, x.tracking_code, x.notes,
    case when exists (select 1 from auth.users u where u.id = x.created_by)
      then x.created_by else v_user end,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(p_backup->'orders') as x(
    id uuid, organization_id uuid, store_id uuid, customer_id uuid,
    external_id text, status text, payment_status text, due_at timestamptz,
    sold_at timestamptz, subtotal numeric, shipping numeric, discount numeric,
    total numeric, tracking_code text, notes text, created_by uuid,
    created_at timestamptz, updated_at timestamptz
  );

  insert into public.order_items (
    id, organization_id, order_id, product_id, sku, name, quantity,
    unit_price, unit_cost, line_total, created_at
  )
  select
    x.id, p_organization_id, x.order_id, x.product_id, x.sku, x.name,
    x.quantity, x.unit_price, x.unit_cost, x.line_total, coalesce(x.created_at, now())
  from jsonb_to_recordset(p_backup->'order_items') as x(
    id uuid, organization_id uuid, order_id uuid, product_id uuid, sku text,
    name text, quantity integer, unit_price numeric, unit_cost numeric,
    line_total numeric, created_at timestamptz
  );

  -- Product inserts create a synthetic initial movement. Remove only those
  -- newly generated rows before restoring the original immutable ledger.
  delete from public.inventory_movements
   where organization_id = p_organization_id;

  insert into public.inventory_movements (
    id, organization_id, product_id, order_id, movement_type, quantity,
    balance_after, unit_cost, notes, created_by, created_at
  )
  select
    x.id, p_organization_id, x.product_id, x.order_id, x.movement_type,
    x.quantity, x.balance_after, x.unit_cost, x.notes,
    case when exists (select 1 from auth.users u where u.id = x.created_by)
      then x.created_by else v_user end,
    coalesce(x.created_at, now())
  from jsonb_to_recordset(p_backup->'inventory_movements') as x(
    id uuid, organization_id uuid, product_id uuid, order_id uuid,
    movement_type text, quantity integer, balance_after integer,
    unit_cost numeric, notes text, created_by uuid, created_at timestamptz
  );

  insert into public.financial_transactions (
    id, organization_id, order_id, kind, category, description, amount,
    occurred_on, status, created_by, created_at, updated_at
  )
  select
    x.id, p_organization_id, x.order_id, x.kind, x.category, x.description,
    x.amount, x.occurred_on, x.status,
    case when exists (select 1 from auth.users u where u.id = x.created_by)
      then x.created_by else v_user end,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(p_backup->'financial_transactions') as x(
    id uuid, organization_id uuid, order_id uuid, kind text, category text,
    description text, amount numeric, occurred_on date, status text,
    created_by uuid, created_at timestamptz, updated_at timestamptz
  );

  insert into public.memberships (organization_id, user_id, role, created_at)
  select
    p_organization_id, x.user_id, x.role, coalesce(x.created_at, now())
  from jsonb_to_recordset(p_backup->'team') as x(
    membership_id uuid, user_id uuid, full_name text, role text, created_at timestamptz
  )
  join auth.users u on u.id = x.user_id
  where x.user_id <> v_user
    and x.role in ('admin', 'operator', 'viewer')
  on conflict (organization_id, user_id) do update
    set role = excluded.role;

  get diagnostics v_team_count = row_count;

  insert into public.audit_logs (
    organization_id, actor_id, entity_type, entity_id, action, after_data
  ) values (
    p_organization_id,
    v_user,
    'workspace_backup',
    p_organization_id::text,
    'insert',
    jsonb_build_object(
      'event', 'restore_completed',
      'source_organization_id', v_source_org,
      'exported_at', p_backup->>'exported_at',
      'schema_version', 1
    )
  );

  return jsonb_build_object(
    'stores', jsonb_array_length(p_backup->'stores'),
    'customers', jsonb_array_length(p_backup->'customers'),
    'products', jsonb_array_length(p_backup->'products'),
    'orders', jsonb_array_length(p_backup->'orders'),
    'order_items', jsonb_array_length(p_backup->'order_items'),
    'inventory_movements', jsonb_array_length(p_backup->'inventory_movements'),
    'financial_transactions', jsonb_array_length(p_backup->'financial_transactions'),
    'team_members', v_team_count
  );
end;
$$;

create or replace function public.restore_workspace_backup(
  p_organization_id uuid,
  p_backup jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.restore_workspace_backup_impl(p_organization_id, p_backup)
$$;

revoke all on function public.restore_workspace_backup(uuid, jsonb) from public;
revoke all on function public.restore_workspace_backup(uuid, jsonb) from anon;
grant execute on function public.restore_workspace_backup(uuid, jsonb) to authenticated;

revoke all on function private.restore_workspace_backup_impl(uuid, jsonb) from public;
revoke all on function private.restore_workspace_backup_impl(uuid, jsonb) from anon;
grant execute on function private.restore_workspace_backup_impl(uuid, jsonb) to authenticated;
