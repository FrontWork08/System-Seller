create or replace function private.restore_workspace_backup_v2_impl(p_organization_id uuid,p_backup jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=(select auth.uid());
 v_core jsonb;
 v_result jsonb;
 v_settings jsonb;
 v_sections text[]:=array['quotes','quote_items','customer_product_prices','production_stages','order_production','production_stage_history','order_costs','attachments','notifications','filament_rolls','filament_movements','order_3d_details','generated_documents','email_outbox','client_mutations','sync_conflicts'];
 v_key text;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and owner_user_id=v_user) then raise exception 'only the organization owner can restore a backup'; end if;
 if p_backup is null or p_backup->>'format'<>'system-seller-workspace-backup' or coalesce((p_backup->>'schema_version')::int,0)<>2 then raise exception 'invalid or unsupported System Seller backup'; end if;
 foreach v_key in array v_sections loop
  if jsonb_typeof(coalesce(p_backup->v_key,'[]'::jsonb))<>'array' then raise exception 'invalid backup section: %',v_key; end if;
  if jsonb_array_length(coalesce(p_backup->v_key,'[]'::jsonb))>100000 then raise exception 'backup section is too large: %',v_key; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,1));
 delete from public.sync_conflicts where organization_id=p_organization_id;
 delete from public.client_mutations where organization_id=p_organization_id;
 delete from public.email_outbox where organization_id=p_organization_id;
 delete from public.generated_documents where organization_id=p_organization_id;
 delete from public.attachments where organization_id=p_organization_id;
 delete from public.notifications where organization_id=p_organization_id;
 delete from public.filament_movements where organization_id=p_organization_id;
 delete from public.order_3d_details where organization_id=p_organization_id;
 delete from public.filament_rolls where organization_id=p_organization_id;
 delete from public.order_costs where organization_id=p_organization_id;
 delete from public.production_stage_history where organization_id=p_organization_id;
 delete from public.order_production where organization_id=p_organization_id;
 delete from public.customer_product_prices where organization_id=p_organization_id;
 delete from public.quote_items where organization_id=p_organization_id;
 delete from public.quotes where organization_id=p_organization_id;
 delete from public.production_stages where organization_id=p_organization_id;
 delete from public.organization_settings where organization_id=p_organization_id;
 v_core:=jsonb_set(p_backup,'{schema_version}','1'::jsonb,true);
 v_result:=private.restore_workspace_backup_impl(p_organization_id,v_core);
 perform private.restore_payment_metadata_impl(p_organization_id,v_core);
 v_settings:=p_backup->'organization_settings';
 insert into public.organization_settings(organization_id,enable_3d,low_filament_threshold_g,stalled_stage_hours,business_email,business_phone,business_document,business_address,document_footer,logo_path,created_at,updated_at)
 values(p_organization_id,coalesce((v_settings->>'enable_3d')::boolean,false),coalesce((v_settings->>'low_filament_threshold_g')::numeric,250),coalesce((v_settings->>'stalled_stage_hours')::int,72),nullif(v_settings->>'business_email',''),nullif(v_settings->>'business_phone',''),nullif(v_settings->>'business_document',''),nullif(v_settings->>'business_address',''),nullif(v_settings->>'document_footer',''),nullif(v_settings->>'logo_path',''),coalesce((v_settings->>'created_at')::timestamptz,now()),coalesce((v_settings->>'updated_at')::timestamptz,now()))
 on conflict(organization_id) do update set enable_3d=excluded.enable_3d,low_filament_threshold_g=excluded.low_filament_threshold_g,stalled_stage_hours=excluded.stalled_stage_hours,business_email=excluded.business_email,business_phone=excluded.business_phone,business_document=excluded.business_document,business_address=excluded.business_address,document_footer=excluded.document_footer,logo_path=excluded.logo_path,updated_at=excluded.updated_at;
 insert into public.production_stages(id,organization_id,name,position,active,created_at,updated_at)
 select x.id,p_organization_id,x.name,x.position,x.active,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'production_stages','[]'::jsonb)) as x(id uuid,organization_id uuid,name text,position int,active boolean,created_at timestamptz,updated_at timestamptz);
 insert into public.quotes(id,organization_id,store_id,customer_id,status,valid_until,delivery_due_at,subtotal,shipping,discount,total,notes,converted_order_id,approved_at,converted_at,created_by,created_at,updated_at)
 select x.id,p_organization_id,x.store_id,x.customer_id,x.status,x.valid_until,x.delivery_due_at,x.subtotal,x.shipping,x.discount,x.total,x.notes,x.converted_order_id,x.approved_at,x.converted_at,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'quotes','[]'::jsonb)) as x(id uuid,organization_id uuid,store_id uuid,customer_id uuid,status text,valid_until date,delivery_due_at timestamptz,subtotal numeric,shipping numeric,discount numeric,total numeric,notes text,converted_order_id uuid,approved_at timestamptz,converted_at timestamptz,created_by uuid,created_at timestamptz,updated_at timestamptz);
 insert into public.quote_items(id,organization_id,quote_id,product_id,sku,name,quantity,unit_price,line_total,created_at)
 select x.id,p_organization_id,x.quote_id,x.product_id,x.sku,x.name,x.quantity,x.unit_price,x.line_total,coalesce(x.created_at,now()) from jsonb_to_recordset(coalesce(p_backup->'quote_items','[]'::jsonb)) as x(id uuid,organization_id uuid,quote_id uuid,product_id uuid,sku text,name text,quantity int,unit_price numeric,line_total numeric,created_at timestamptz);
 insert into public.customer_product_prices(id,organization_id,customer_id,product_id,unit_price,created_by,created_at,updated_at)
 select x.id,p_organization_id,x.customer_id,x.product_id,x.unit_price,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'customer_product_prices','[]'::jsonb)) as x(id uuid,organization_id uuid,customer_id uuid,product_id uuid,unit_price numeric,created_by uuid,created_at timestamptz,updated_at timestamptz);
 insert into public.order_production(order_id,organization_id,stage_id,planned_start,planned_finish,estimated_minutes,responsible_user_id,notes,updated_by,created_at,updated_at)
 select x.order_id,p_organization_id,x.stage_id,x.planned_start,x.planned_finish,x.estimated_minutes,case when exists(select 1 from auth.users u where u.id=x.responsible_user_id) then x.responsible_user_id else null end,x.notes,case when exists(select 1 from auth.users u where u.id=x.updated_by) then x.updated_by else v_user end,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'order_production','[]'::jsonb)) as x(order_id uuid,organization_id uuid,stage_id uuid,planned_start timestamptz,planned_finish timestamptz,estimated_minutes int,responsible_user_id uuid,notes text,updated_by uuid,created_at timestamptz,updated_at timestamptz);
 insert into public.production_stage_history(id,organization_id,order_id,stage_id,stage_name_snapshot,entered_at,exited_at,changed_by,notes)
 select x.id,p_organization_id,x.order_id,x.stage_id,x.stage_name_snapshot,x.entered_at,x.exited_at,case when exists(select 1 from auth.users u where u.id=x.changed_by) then x.changed_by else v_user end,x.notes from jsonb_to_recordset(coalesce(p_backup->'production_stage_history','[]'::jsonb)) as x(id uuid,organization_id uuid,order_id uuid,stage_id uuid,stage_name_snapshot text,entered_at timestamptz,exited_at timestamptz,changed_by uuid,notes text);
 insert into public.order_costs(id,organization_id,order_id,order_item_id,category,description,amount,occurred_on,created_by,created_at,updated_at)
 select x.id,p_organization_id,x.order_id,x.order_item_id,x.category,x.description,x.amount,x.occurred_on,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'order_costs','[]'::jsonb)) as x(id uuid,organization_id uuid,order_id uuid,order_item_id uuid,category text,description text,amount numeric,occurred_on date,created_by uuid,created_at timestamptz,updated_at timestamptz);
 insert into public.attachments(id,organization_id,entity_type,entity_id,storage_path,original_filename,mime_type,size_bytes,uploaded_by,created_at)
 select x.id,p_organization_id,x.entity_type,x.entity_id,x.storage_path,x.original_filename,x.mime_type,x.size_bytes,case when exists(select 1 from auth.users u where u.id=x.uploaded_by) then x.uploaded_by else v_user end,coalesce(x.created_at,now()) from jsonb_to_recordset(coalesce(p_backup->'attachments','[]'::jsonb)) as x(id uuid,organization_id uuid,entity_type text,entity_id uuid,storage_path text,original_filename text,mime_type text,size_bytes bigint,uploaded_by uuid,created_at timestamptz);
 insert into public.notifications(id,organization_id,event_type,entity_type,entity_id,dedupe_key,title,body,severity,read_at,created_at)
 select x.id,p_organization_id,x.event_type,x.entity_type,x.entity_id,x.dedupe_key,x.title,x.body,x.severity,x.read_at,coalesce(x.created_at,now()) from jsonb_to_recordset(coalesce(p_backup->'notifications','[]'::jsonb)) as x(id uuid,organization_id uuid,event_type text,entity_type text,entity_id text,dedupe_key text,title text,body text,severity text,read_at timestamptz,created_at timestamptz);
 insert into public.filament_rolls(id,organization_id,material,color,brand,initial_weight_g,remaining_weight_g,purchase_cost,acquired_on,status,notes,created_at,updated_at)
 select x.id,p_organization_id,x.material,x.color,x.brand,x.initial_weight_g,x.remaining_weight_g,x.purchase_cost,x.acquired_on,x.status,x.notes,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'filament_rolls','[]'::jsonb)) as x(id uuid,organization_id uuid,material text,color text,brand text,initial_weight_g numeric,remaining_weight_g numeric,purchase_cost numeric,acquired_on date,status text,notes text,created_at timestamptz,updated_at timestamptz);
 insert into public.filament_movements(id,organization_id,roll_id,order_id,order_item_id,movement_type,quantity_g,balance_after_g,notes,created_by,created_at)
 select x.id,p_organization_id,x.roll_id,x.order_id,x.order_item_id,x.movement_type,x.quantity_g,x.balance_after_g,x.notes,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()) from jsonb_to_recordset(coalesce(p_backup->'filament_movements','[]'::jsonb)) as x(id uuid,organization_id uuid,roll_id uuid,order_id uuid,order_item_id uuid,movement_type text,quantity_g numeric,balance_after_g numeric,notes text,created_by uuid,created_at timestamptz);
 insert into public.order_3d_details(order_id,organization_id,model_reference,material,color,estimated_minutes,actual_minutes,finishing_notes,created_at,updated_at)
 select x.order_id,p_organization_id,x.model_reference,x.material,x.color,x.estimated_minutes,x.actual_minutes,x.finishing_notes,coalesce(x.created_at,now()),coalesce(x.updated_at,now()) from jsonb_to_recordset(coalesce(p_backup->'order_3d_details','[]'::jsonb)) as x(order_id uuid,organization_id uuid,model_reference text,material text,color text,estimated_minutes int,actual_minutes int,finishing_notes text,created_at timestamptz,updated_at timestamptz);
 insert into public.generated_documents(id,organization_id,document_type,source_type,source_id,storage_path,snapshot,created_by,created_at)
 select x.id,p_organization_id,x.document_type,x.source_type,x.source_id,x.storage_path,x.snapshot,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()) from jsonb_to_recordset(coalesce(p_backup->'generated_documents','[]'::jsonb)) as x(id uuid,organization_id uuid,document_type text,source_type text,source_id uuid,storage_path text,snapshot jsonb,created_by uuid,created_at timestamptz);
 insert into public.email_outbox(id,organization_id,recipient,subject,body,status,attempts,last_error,provider_message_id,related_type,related_id,created_by,created_at,updated_at,sent_at)
 select x.id,p_organization_id,x.recipient,x.subject,x.body,x.status,x.attempts,x.last_error,x.provider_message_id,x.related_type,x.related_id,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()),coalesce(x.updated_at,now()),x.sent_at from jsonb_to_recordset(coalesce(p_backup->'email_outbox','[]'::jsonb)) as x(id uuid,organization_id uuid,recipient text,subject text,body text,status text,attempts int,last_error text,provider_message_id text,related_type text,related_id uuid,created_by uuid,created_at timestamptz,updated_at timestamptz,sent_at timestamptz);
 insert into public.client_mutations(id,organization_id,mutation_id,mutation_type,payload,base_updated_at,client_created_at,user_id,status,result,created_at)
 select x.id,p_organization_id,x.mutation_id,x.mutation_type,x.payload,x.base_updated_at,x.client_created_at,case when exists(select 1 from auth.users u where u.id=x.user_id) then x.user_id else v_user end,x.status,x.result,coalesce(x.created_at,now()) from jsonb_to_recordset(coalesce(p_backup->'client_mutations','[]'::jsonb)) as x(id uuid,organization_id uuid,mutation_id uuid,mutation_type text,payload jsonb,base_updated_at timestamptz,client_created_at timestamptz,user_id uuid,status text,result jsonb,created_at timestamptz);
 insert into public.sync_conflicts(id,organization_id,mutation_id,mutation_type,entity_type,entity_id,payload,base_updated_at,server_updated_at,status,resolution,created_by,created_at,resolved_at)
 select x.id,p_organization_id,x.mutation_id,x.mutation_type,x.entity_type,x.entity_id,x.payload,x.base_updated_at,x.server_updated_at,x.status,x.resolution,case when exists(select 1 from auth.users u where u.id=x.created_by) then x.created_by else v_user end,coalesce(x.created_at,now()),x.resolved_at from jsonb_to_recordset(coalesce(p_backup->'sync_conflicts','[]'::jsonb)) as x(id uuid,organization_id uuid,mutation_id uuid,mutation_type text,entity_type text,entity_id uuid,payload jsonb,base_updated_at timestamptz,server_updated_at timestamptz,status text,resolution text,created_by uuid,created_at timestamptz,resolved_at timestamptz);
 return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('schema_version',2,'quotes',jsonb_array_length(coalesce(p_backup->'quotes','[]'::jsonb)),'production_stages',jsonb_array_length(coalesce(p_backup->'production_stages','[]'::jsonb)),'attachments',jsonb_array_length(coalesce(p_backup->'attachments','[]'::jsonb)),'generated_documents',jsonb_array_length(coalesce(p_backup->'generated_documents','[]'::jsonb)));
end $$;

create or replace function public.restore_workspace_backup_v2(p_organization_id uuid,p_backup jsonb)
returns jsonb language sql set search_path='' as $$ select private.restore_workspace_backup_v2_impl(p_organization_id,p_backup) $$;
revoke all on function public.restore_workspace_backup_v2(uuid,jsonb) from public;
grant execute on function public.restore_workspace_backup_v2(uuid,jsonb) to authenticated;
