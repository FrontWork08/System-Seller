create or replace function private.refresh_notifications_impl(p_org uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_threshold numeric(12,2); v_stalled int;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_org not in (select private.user_org_ids()) then raise exception 'Forbidden'; end if;
  insert into public.organization_settings(organization_id) values(p_org) on conflict do nothing;
  select low_filament_threshold_g,stalled_stage_hours into v_threshold,v_stalled from public.organization_settings where organization_id=p_org;
  insert into public.notifications(organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity)
  select p_org,'order_overdue','order',o.id::text,'order-overdue:'||o.id::text,'Pedido atrasado',coalesce(o.external_id,o.id::text)||' passou do prazo de entrega.','danger'
  from public.orders o where o.organization_id=p_org and o.due_at<now() and o.status not in ('shipped','delivered','cancelled') on conflict (organization_id,dedupe_key) do nothing;
  insert into public.notifications(organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity)
  select p_org,'payment_outstanding','order',o.id::text,'payment-outstanding:'||o.id::text,'Pagamento pendente',coalesce(o.external_id,o.id::text)||' possui saldo de '||to_char(greatest(o.total-o.paid_amount,0),'FM999999990D00')||'.','warning'
  from public.orders o where o.organization_id=p_org and o.status<>'cancelled' and o.paid_amount<o.total on conflict (organization_id,dedupe_key) do nothing;
  insert into public.notifications(organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity)
  select p_org,'stock_low','product',p.id::text,'stock-low:'||p.id::text,'Estoque baixo',p.name||' está com '||p.stock||' unidade(s).','warning'
  from public.products p where p.organization_id=p_org and p.active=true and p.stock<=p.min_stock on conflict (organization_id,dedupe_key) do nothing;
  insert into public.notifications(organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity)
  select p_org,'filament_low','filament_roll',r.id::text,'filament-low:'||r.id::text,'Filamento baixo',r.material||' '||r.color||' possui '||r.remaining_weight_g||' g restantes.','warning'
  from public.filament_rolls r where r.organization_id=p_org and r.status='active' and r.remaining_weight_g<=v_threshold on conflict (organization_id,dedupe_key) do nothing;
  insert into public.notifications(organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity)
  select p_org,'production_stalled','order',h.order_id::text,'production-stalled:'||h.order_id::text||':'||h.stage_id::text,'Produção parada','Pedido em '||h.stage_name_snapshot||' há mais de '||v_stalled||' hora(s).','warning'
  from public.production_stage_history h where h.organization_id=p_org and h.exited_at is null and h.entered_at < now()-(v_stalled||' hours')::interval on conflict (organization_id,dedupe_key) do nothing;
  return (select count(*)::int from public.notifications where organization_id=p_org and read_at is null);
end $$;
create or replace function public.refresh_notifications(p_organization_id uuid) returns integer language sql set search_path='' as $$ select private.refresh_notifications_impl(p_organization_id) $$;

create or replace function private.get_operational_report_impl(p_org uuid,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_from date:=coalesce(p_from,current_date-30); v_to date:=coalesce(p_to,current_date); v_result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.has_org_role(p_org,array['owner','admin']) then raise exception 'Forbidden'; end if;
  if v_to<v_from then raise exception 'Invalid date range'; end if;
  select jsonb_build_object(
    'from',v_from,'to',v_to,
    'revenue',coalesce((select sum(total) from public.orders where organization_id=p_org and status<>'cancelled' and sold_at::date between v_from and v_to),0),
    'receivable',coalesce((select sum(greatest(total-paid_amount,0)) from public.orders where organization_id=p_org and status<>'cancelled'),0),
    'costs',coalesce((select sum(amount) from public.order_costs where organization_id=p_org and occurred_on between v_from and v_to),0),
    'gross_profit',coalesce((select sum(total) from public.orders where organization_id=p_org and status<>'cancelled' and sold_at::date between v_from and v_to),0)-coalesce((select sum(amount) from public.order_costs where organization_id=p_org and occurred_on between v_from and v_to),0),
    'average_ticket',coalesce((select avg(total) from public.orders where organization_id=p_org and status<>'cancelled' and sold_at::date between v_from and v_to),0),
    'overdue_orders',(select count(*) from public.orders where organization_id=p_org and due_at<now() and status not in ('shipped','delivered','cancelled')),
    'due_soon',(select count(*) from public.orders where organization_id=p_org and due_at between now() and now()+interval '48 hours' and status not in ('shipped','delivered','cancelled')),
    'top_products',coalesce((select jsonb_agg(x) from (select oi.product_id,oi.name,sum(oi.quantity) quantity,sum(oi.line_total) sales from public.order_items oi join public.orders o on o.id=oi.order_id where oi.organization_id=p_org and o.status<>'cancelled' and o.sold_at::date between v_from and v_to group by oi.product_id,oi.name order by sales desc limit 10) x),'[]'::jsonb),
    'top_customers',coalesce((select jsonb_agg(x) from (select o.customer_id,coalesce(c.name,'Sem cliente') name,sum(o.total) sales from public.orders o left join public.customers c on c.id=o.customer_id where o.organization_id=p_org and o.status<>'cancelled' and o.sold_at::date between v_from and v_to group by o.customer_id,c.name order by sales desc limit 10) x),'[]'::jsonb),
    'sales_by_store',coalesce((select jsonb_agg(x) from (select o.store_id,coalesce(s.name,'Sem loja') name,sum(o.total) sales from public.orders o left join public.stores s on s.id=o.store_id where o.organization_id=p_org and o.status<>'cancelled' and o.sold_at::date between v_from and v_to group by o.store_id,s.name order by sales desc) x),'[]'::jsonb),
    'production_workload',(select count(*) from public.order_production op join public.orders o on o.id=op.order_id where op.organization_id=p_org and o.status not in ('delivered','cancelled'))
  ) into v_result;
  return v_result;
end $$;
create or replace function public.get_operational_report(p_organization_id uuid,p_from date default null,p_to date default null) returns jsonb language sql set search_path='' as $$ select private.get_operational_report_impl(p_organization_id,p_from,p_to) $$;

create or replace function private.queue_business_email_impl(p_org uuid,p_recipient text,p_subject text,p_body text,p_related_type text,p_related_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.has_org_role(p_org,array['owner','admin']) then raise exception 'Forbidden'; end if;
  if position('@' in coalesce(p_recipient,''))<2 then raise exception 'Invalid recipient'; end if;
  if char_length(btrim(coalesce(p_subject,'')))<1 or char_length(btrim(coalesce(p_body,'')))<1 then raise exception 'Subject and body are required'; end if;
  insert into public.email_outbox(id,organization_id,recipient,subject,body,related_type,related_id,created_by)
  values(v_id,p_org,btrim(p_recipient),btrim(p_subject),p_body,p_related_type,p_related_id,(select auth.uid()));
  return v_id;
end $$;
create or replace function public.queue_business_email(p_organization_id uuid,p_recipient text,p_subject text,p_body text,p_related_type text default null,p_related_id uuid default null) returns uuid language sql set search_path='' as $$ select private.queue_business_email_impl(p_organization_id,p_recipient,p_subject,p_body,p_related_type,p_related_id) $$;

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
    select updated_at into v_server_updated from public.order_production where order_id=v_entity;
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
create or replace function public.apply_offline_mutation(p_organization_id uuid,p_mutation_id uuid,p_type text,p_payload jsonb,p_base_updated_at timestamptz default null,p_client_created_at timestamptz default null) returns jsonb language sql set search_path='' as $$ select private.apply_offline_mutation_impl(p_organization_id,p_mutation_id,p_type,p_payload,p_base_updated_at,p_client_created_at) $$;

create or replace function private.resolve_sync_conflict_impl(p_conflict_id uuid,p_status text,p_resolution text)
returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('resolved','dismissed') then raise exception 'Invalid conflict status'; end if;
  select organization_id into v_org from public.sync_conflicts where id=p_conflict_id;
  if v_org is null then raise exception 'Conflict not found'; end if;
  if not private.has_org_role(v_org,array['owner','admin','operator']) then raise exception 'Forbidden'; end if;
  update public.sync_conflicts set status=p_status,resolution=nullif(btrim(p_resolution),''),resolved_at=now() where id=p_conflict_id;
end $$;
create or replace function public.resolve_sync_conflict(p_conflict_id uuid,p_status text,p_resolution text default null) returns void language sql set search_path='' as $$ select private.resolve_sync_conflict_impl(p_conflict_id,p_status,p_resolution) $$;

create or replace function private.storage_path_org(p_name text)
returns uuid language plpgsql immutable set search_path='' as $$
declare v text;
begin
  v := (storage.foldername(p_name))[1];
  return v::uuid;
exception when others then return null;
end $$;
revoke all on function private.storage_path_org(text) from public;
grant execute on function private.storage_path_org(text) to authenticated;

do $$ begin
  insert into storage.buckets(id,name,public,file_size_limit) values('business-files','business-files',false,15728640)
  on conflict (id) do update set public=false,file_size_limit=15728640;
exception when undefined_column then
  insert into storage.buckets(id,name,public) values('business-files','business-files',false) on conflict (id) do update set public=false;
end $$;

drop policy if exists business_files_read on storage.objects;
drop policy if exists business_files_insert on storage.objects;
drop policy if exists business_files_update on storage.objects;
drop policy if exists business_files_delete on storage.objects;
create policy business_files_read on storage.objects for select to authenticated using (bucket_id='business-files' and private.storage_path_org(name) in (select private.user_org_ids()));
create policy business_files_insert on storage.objects for insert to authenticated with check (bucket_id='business-files' and private.has_org_role(private.storage_path_org(name),array['owner','admin','operator']));
create policy business_files_update on storage.objects for update to authenticated using (bucket_id='business-files' and private.has_org_role(private.storage_path_org(name),array['owner','admin','operator'])) with check (bucket_id='business-files' and private.has_org_role(private.storage_path_org(name),array['owner','admin','operator']));
create policy business_files_delete on storage.objects for delete to authenticated using (bucket_id='business-files' and private.has_org_role(private.storage_path_org(name),array['owner','admin','operator']));

revoke all on function public.refresh_notifications(uuid) from public;
revoke all on function public.get_operational_report(uuid,date,date) from public;
revoke all on function public.queue_business_email(uuid,text,text,text,text,uuid) from public;
revoke all on function public.apply_offline_mutation(uuid,uuid,text,jsonb,timestamptz,timestamptz) from public;
revoke all on function public.resolve_sync_conflict(uuid,text,text) from public;
grant execute on function public.refresh_notifications(uuid) to authenticated;
grant execute on function public.get_operational_report(uuid,date,date) to authenticated;
grant execute on function public.queue_business_email(uuid,text,text,text,text,uuid) to authenticated;
grant execute on function public.apply_offline_mutation(uuid,uuid,text,jsonb,timestamptz,timestamptz) to authenticated;
grant execute on function public.resolve_sync_conflict(uuid,text,text) to authenticated;
