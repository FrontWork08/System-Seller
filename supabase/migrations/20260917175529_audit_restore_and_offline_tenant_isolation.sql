create or replace function private.restore_audit_logs_backup_impl(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_restored integer := 0;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and owner_user_id=v_user) then
    raise exception 'only the organization owner can restore a backup';
  end if;
  if jsonb_typeof(coalesce(p_backup->'audit_logs','[]'::jsonb)) <> 'array' then
    raise exception 'invalid backup section: audit_logs';
  end if;
  if jsonb_array_length(coalesce(p_backup->'audit_logs','[]'::jsonb)) > 100000 then
    raise exception 'backup section is too large: audit_logs';
  end if;

  delete from public.audit_logs where organization_id=p_organization_id;

  insert into public.audit_logs(
    organization_id, actor_id, entity_type, entity_id, action, before_data, after_data, created_at
  )
  select
    p_organization_id,
    case when x.actor_id is not null and exists(select 1 from auth.users u where u.id=x.actor_id) then x.actor_id else null end,
    x.entity_type,
    x.entity_id,
    x.action,
    x.before_data,
    x.after_data,
    coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_backup->'audit_logs','[]'::jsonb)) as x(
    id bigint,
    organization_id uuid,
    actor_id uuid,
    entity_type text,
    entity_id text,
    action text,
    before_data jsonb,
    after_data jsonb,
    created_at timestamptz
  )
  where x.entity_type is not null
    and x.entity_id is not null
    and x.action in ('insert','update','delete');

  get diagnostics v_restored = row_count;

  insert into public.audit_logs(
    organization_id, actor_id, entity_type, entity_id, action, after_data
  ) values (
    p_organization_id,
    v_user,
    'workspace_backup',
    p_organization_id::text,
    'insert',
    jsonb_build_object(
      'event','restore_completed',
      'source_organization_id',p_backup->'organization'->>'id',
      'exported_at',p_backup->>'exported_at',
      'schema_version',coalesce((p_backup->>'schema_version')::int,1)
    )
  );

  return jsonb_build_object('audit_logs',v_restored);
end $$;

revoke all on function private.restore_audit_logs_backup_impl(uuid,jsonb) from public;

create or replace function public.restore_workspace_backup(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_result jsonb;
  v_audit jsonb;
begin
  v_result := private.restore_workspace_backup_impl(p_organization_id, p_backup);
  perform private.restore_payment_metadata_impl(p_organization_id, p_backup);
  v_audit := private.restore_audit_logs_backup_impl(p_organization_id, p_backup);
  return coalesce(v_result,'{}'::jsonb) || coalesce(v_audit,'{}'::jsonb);
end $$;

revoke all on function public.restore_workspace_backup(uuid,jsonb) from public;
grant execute on function public.restore_workspace_backup(uuid,jsonb) to authenticated;

create or replace function public.restore_workspace_backup_v2(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_result jsonb;
  v_pricing jsonb;
  v_quote_history jsonb;
  v_audit jsonb;
begin
  v_result := private.restore_workspace_backup_v2_impl(p_organization_id, p_backup);
  v_pricing := private.restore_3d_pricing_backup_v2_impl(p_organization_id, p_backup);
  v_quote_history := private.restore_quote_status_history_backup_v2_impl(p_organization_id, p_backup);
  v_audit := private.restore_audit_logs_backup_impl(p_organization_id, p_backup);
  return coalesce(v_result, '{}'::jsonb)
    || coalesce(v_pricing, '{}'::jsonb)
    || coalesce(v_quote_history, '{}'::jsonb)
    || coalesce(v_audit, '{}'::jsonb);
end $$;

revoke all on function public.restore_workspace_backup_v2(uuid,jsonb) from public;
grant execute on function public.restore_workspace_backup_v2(uuid,jsonb) to authenticated;

create or replace function private.apply_offline_mutation_impl(p_org uuid,p_mutation_id uuid,p_type text,p_payload jsonb,p_base_updated_at timestamptz,p_client_created_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.client_mutations%rowtype; v_result jsonb; v_id uuid; v_entity uuid; v_server_updated timestamptz; v_items jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.has_org_role(p_org,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
  select * into v_existing from public.client_mutations where organization_id=p_org and mutation_id=p_mutation_id;
  if found then return coalesce(v_existing.result,jsonb_build_object('status',v_existing.status)); end if;
  if p_type='quote_create' then
    v_items:=p_payload->'items';
    v_id:=private.create_quote_impl(p_org,nullif(p_payload->>'store_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,nullif(p_payload->>'valid_until','')::date,nullif(p_payload->>'delivery_due_at','')::timestamptz,coalesce(nullif(p_payload->>'shipping','')::numeric,0),coalesce(nullif(p_payload->>'discount','')::numeric,0),p_payload->>'notes',v_items);
    v_result=jsonb_build_object('status','applied','entity_type','quote','entity_id',v_id);
  elsif p_type='order_create' then
    v_items:=p_payload->'items';
    v_id:=private.create_order_impl(p_org,nullif(p_payload->>'store_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,nullif(p_payload->>'external_id',''),'pending',nullif(p_payload->>'due_at','')::timestamptz,coalesce(nullif(p_payload->>'sold_at','')::timestamptz,now()),coalesce(nullif(p_payload->>'shipping','')::numeric,0),coalesce(nullif(p_payload->>'discount','')::numeric,0),nullif(p_payload->>'tracking_code',''),p_payload->>'notes',v_items);
    v_result=jsonb_build_object('status','applied','entity_type','order','entity_id',v_id);
  elsif p_type='production_update' then
    v_entity=(p_payload->>'order_id')::uuid;
    if not exists(select 1 from public.orders where id=v_entity and organization_id=p_org) then
      raise exception 'Order not found';
    end if;
    select updated_at into v_server_updated from public.order_production where order_id=v_entity and organization_id=p_org;
    if v_server_updated is not null and p_base_updated_at is not null and v_server_updated>p_base_updated_at then
      insert into public.sync_conflicts(organization_id,mutation_id,mutation_type,entity_type,entity_id,payload,base_updated_at,server_updated_at,created_by)
      values(p_org,p_mutation_id,p_type,'order_production',v_entity,p_payload,p_base_updated_at,v_server_updated,(select auth.uid()));
      v_result=jsonb_build_object('status','conflict','entity_type','order_production','entity_id',v_entity,'server_updated_at',v_server_updated);
    else
      perform private.upsert_order_production_impl(v_entity,nullif(p_payload->>'stage_id','')::uuid,nullif(p_payload->>'planned_start','')::timestamptz,nullif(p_payload->>'planned_finish','')::timestamptz,nullif(p_payload->>'estimated_minutes','')::int,nullif(p_payload->>'responsible_user_id','')::uuid,p_payload->>'notes');
      v_result=jsonb_build_object('status','applied','entity_type','order_production','entity_id',v_entity);
    end if;
  elsif p_type='order_notes' then
    v_entity=(p_payload->>'order_id')::uuid;
    select updated_at into v_server_updated from public.orders where id=v_entity and organization_id=p_org;
    if v_server_updated is null then raise exception 'Order not found'; end if;
    if p_base_updated_at is not null and v_server_updated>p_base_updated_at then
      insert into public.sync_conflicts(organization_id,mutation_id,mutation_type,entity_type,entity_id,payload,base_updated_at,server_updated_at,created_by)
      values(p_org,p_mutation_id,p_type,'order',v_entity,p_payload,p_base_updated_at,v_server_updated,(select auth.uid()));
      v_result=jsonb_build_object('status','conflict','entity_type','order','entity_id',v_entity,'server_updated_at',v_server_updated);
    else
      update public.orders set notes=nullif(btrim(p_payload->>'notes'),''),updated_at=now() where id=v_entity and organization_id=p_org;
      v_result=jsonb_build_object('status','applied','entity_type','order','entity_id',v_entity);
    end if;
  else
    raise exception 'Offline mutation type is not allowed';
  end if;
  insert into public.client_mutations(organization_id,mutation_id,mutation_type,payload,base_updated_at,client_created_at,user_id,status,result)
  values(p_org,p_mutation_id,p_type,p_payload,p_base_updated_at,coalesce(p_client_created_at,now()),(select auth.uid()),case when v_result->>'status'='conflict' then 'conflict' else 'applied' end,v_result);
  if v_result->>'status'='conflict' then
    insert into public.notifications(organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity)
    values(p_org,'offline_conflict',v_result->>'entity_type',v_result->>'entity_id','offline-conflict:'||p_mutation_id::text,'Conflito de sincronização','Uma alteração feita offline precisa de revisão.','danger') on conflict (organization_id,dedupe_key) do nothing;
  end if;
  return v_result;
end $$;

revoke all on function private.apply_offline_mutation_impl(uuid,uuid,text,jsonb,timestamptz,timestamptz) from public;
