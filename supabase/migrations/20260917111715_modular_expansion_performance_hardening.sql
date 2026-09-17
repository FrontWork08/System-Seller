create index if not exists attachments_uploaded_by_idx on public.attachments(uploaded_by);
create index if not exists client_mutations_user_id_idx on public.client_mutations(user_id);
create index if not exists customer_product_prices_created_by_idx on public.customer_product_prices(created_by);
create index if not exists customer_product_prices_customer_id_idx on public.customer_product_prices(customer_id);
create index if not exists customer_product_prices_product_id_idx on public.customer_product_prices(product_id);
create index if not exists email_outbox_created_by_idx on public.email_outbox(created_by);
create index if not exists filament_movements_created_by_idx on public.filament_movements(created_by);
create index if not exists filament_movements_order_id_idx on public.filament_movements(order_id);
create index if not exists filament_movements_order_item_id_idx on public.filament_movements(order_item_id);
create index if not exists filament_movements_organization_id_idx on public.filament_movements(organization_id);
create index if not exists generated_documents_created_by_idx on public.generated_documents(created_by);
create index if not exists order_3d_details_organization_id_idx on public.order_3d_details(organization_id);
create index if not exists order_costs_created_by_idx on public.order_costs(created_by);
create index if not exists order_costs_order_item_id_idx on public.order_costs(order_item_id);
create index if not exists order_costs_organization_id_idx on public.order_costs(organization_id);
create index if not exists order_production_responsible_user_id_idx on public.order_production(responsible_user_id);
create index if not exists order_production_stage_id_idx on public.order_production(stage_id);
create index if not exists order_production_updated_by_idx on public.order_production(updated_by);
create index if not exists production_stage_history_changed_by_idx on public.production_stage_history(changed_by);
create index if not exists production_stage_history_organization_id_idx on public.production_stage_history(organization_id);
create index if not exists production_stage_history_stage_id_idx on public.production_stage_history(stage_id);
create index if not exists quote_items_organization_id_idx on public.quote_items(organization_id);
create index if not exists quote_items_product_id_idx on public.quote_items(product_id);
create index if not exists quote_status_history_changed_by_idx on public.quote_status_history(changed_by);
create index if not exists quote_status_history_organization_id_idx on public.quote_status_history(organization_id);
create index if not exists quotes_created_by_idx on public.quotes(created_by);
create index if not exists quotes_customer_id_idx on public.quotes(customer_id);
create index if not exists quotes_store_id_idx on public.quotes(store_id);
create index if not exists sync_conflicts_created_by_idx on public.sync_conflicts(created_by);

drop policy if exists production_stages_write on public.production_stages;
create policy production_stages_insert on public.production_stages for insert to authenticated
  with check (private.has_org_role(organization_id,array['owner','admin']));
create policy production_stages_update on public.production_stages for update to authenticated
  using (private.has_org_role(organization_id,array['owner','admin']))
  with check (private.has_org_role(organization_id,array['owner','admin']));
create policy production_stages_delete on public.production_stages for delete to authenticated
  using (private.has_org_role(organization_id,array['owner','admin']));

drop policy if exists order_production_write on public.order_production;
create policy order_production_insert on public.order_production for insert to authenticated
  with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy order_production_update on public.order_production for update to authenticated
  using (private.has_org_role(organization_id,array['owner','admin','operator']))
  with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy order_production_delete on public.order_production for delete to authenticated
  using (private.has_org_role(organization_id,array['owner','admin']));

drop policy if exists filament_rolls_write on public.filament_rolls;
create policy filament_rolls_insert on public.filament_rolls for insert to authenticated
  with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy filament_rolls_update on public.filament_rolls for update to authenticated
  using (private.has_org_role(organization_id,array['owner','admin','operator']))
  with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy filament_rolls_delete on public.filament_rolls for delete to authenticated
  using (private.has_org_role(organization_id,array['owner','admin']));

drop policy if exists order_3d_details_write on public.order_3d_details;
create policy order_3d_details_insert on public.order_3d_details for insert to authenticated
  with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy order_3d_details_update on public.order_3d_details for update to authenticated
  using (private.has_org_role(organization_id,array['owner','admin','operator']))
  with check (private.has_org_role(organization_id,array['owner','admin','operator']));
create policy order_3d_details_delete on public.order_3d_details for delete to authenticated
  using (private.has_org_role(organization_id,array['owner','admin']));
