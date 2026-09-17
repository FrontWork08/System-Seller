create or replace function private.restore_3d_pricing_backup_v2_impl(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_settings jsonb := coalesce(p_backup->'organization_settings', '{}'::jsonb);
  v_restored integer := 0;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and owner_user_id=v_user) then
    raise exception 'only the organization owner can restore a backup';
  end if;

  update public.organization_settings
  set electricity_price_per_kwh = coalesce(nullif(v_settings->>'electricity_price_per_kwh','')::numeric, electricity_price_per_kwh),
      printer_power_watts = coalesce(nullif(v_settings->>'printer_power_watts','')::numeric, printer_power_watts),
      machine_hour_cost = coalesce(nullif(v_settings->>'machine_hour_cost','')::numeric, machine_hour_cost),
      labor_hour_cost = coalesce(nullif(v_settings->>'labor_hour_cost','')::numeric, labor_hour_cost),
      default_3d_margin_pct = coalesce(nullif(v_settings->>'default_3d_margin_pct','')::numeric, default_3d_margin_pct),
      updated_at = now()
  where organization_id = p_organization_id;

  update public.order_3d_details d
  set estimated_material_g = coalesce(x.estimated_material_g, d.estimated_material_g),
      labor_minutes = coalesce(x.labor_minutes, d.labor_minutes),
      material_cost = coalesce(x.material_cost, d.material_cost),
      energy_cost = coalesce(x.energy_cost, d.energy_cost),
      machine_cost = coalesce(x.machine_cost, d.machine_cost),
      labor_cost = coalesce(x.labor_cost, d.labor_cost),
      estimated_cost = coalesce(x.estimated_cost, d.estimated_cost),
      suggested_price = coalesce(x.suggested_price, d.suggested_price),
      final_price = coalesce(x.final_price, d.final_price),
      pricing_margin_pct = coalesce(x.pricing_margin_pct, d.pricing_margin_pct),
      pricing_snapshot = coalesce(x.pricing_snapshot, d.pricing_snapshot),
      pricing_calculated_at = coalesce(x.pricing_calculated_at, d.pricing_calculated_at),
      updated_at = coalesce(x.updated_at, d.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup->'order_3d_details', '[]'::jsonb)) as x(
    order_id uuid,
    estimated_material_g numeric,
    labor_minutes integer,
    material_cost numeric,
    energy_cost numeric,
    machine_cost numeric,
    labor_cost numeric,
    estimated_cost numeric,
    suggested_price numeric,
    final_price numeric,
    pricing_margin_pct numeric,
    pricing_snapshot jsonb,
    pricing_calculated_at timestamptz,
    updated_at timestamptz
  )
  where d.organization_id = p_organization_id and d.order_id = x.order_id;

  get diagnostics v_restored = row_count;
  return jsonb_build_object('3d_pricing_rows', v_restored);
end $$;

create or replace function public.restore_workspace_backup_v2(p_organization_id uuid, p_backup jsonb)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_result jsonb;
  v_pricing jsonb;
begin
  v_result := private.restore_workspace_backup_v2_impl(p_organization_id, p_backup);
  v_pricing := private.restore_3d_pricing_backup_v2_impl(p_organization_id, p_backup);
  return coalesce(v_result, '{}'::jsonb) || coalesce(v_pricing, '{}'::jsonb);
end $$;

revoke all on function public.restore_workspace_backup_v2(uuid,jsonb) from public;
grant execute on function public.restore_workspace_backup_v2(uuid,jsonb) to authenticated;
