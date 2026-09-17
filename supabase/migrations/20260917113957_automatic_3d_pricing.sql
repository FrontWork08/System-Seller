alter table public.organization_settings
  add column if not exists electricity_price_per_kwh numeric(12,4) not null default 0,
  add column if not exists printer_power_watts numeric(12,2) not null default 0,
  add column if not exists machine_hour_cost numeric(12,2) not null default 0,
  add column if not exists labor_hour_cost numeric(12,2) not null default 0,
  add column if not exists default_3d_margin_pct numeric(5,2) not null default 30;

alter table public.organization_settings
  drop constraint if exists organization_settings_electricity_price_nonnegative,
  drop constraint if exists organization_settings_printer_power_nonnegative,
  drop constraint if exists organization_settings_machine_hour_cost_nonnegative,
  drop constraint if exists organization_settings_labor_hour_cost_nonnegative,
  drop constraint if exists organization_settings_3d_margin_range;

alter table public.organization_settings
  add constraint organization_settings_electricity_price_nonnegative check (electricity_price_per_kwh >= 0),
  add constraint organization_settings_printer_power_nonnegative check (printer_power_watts >= 0),
  add constraint organization_settings_machine_hour_cost_nonnegative check (machine_hour_cost >= 0),
  add constraint organization_settings_labor_hour_cost_nonnegative check (labor_hour_cost >= 0),
  add constraint organization_settings_3d_margin_range check (default_3d_margin_pct >= 0 and default_3d_margin_pct < 100);

alter table public.order_3d_details
  add column if not exists estimated_material_g numeric(12,2),
  add column if not exists labor_minutes integer,
  add column if not exists material_cost numeric(12,2),
  add column if not exists energy_cost numeric(12,2),
  add column if not exists machine_cost numeric(12,2),
  add column if not exists labor_cost numeric(12,2),
  add column if not exists estimated_cost numeric(12,2),
  add column if not exists suggested_price numeric(12,2),
  add column if not exists final_price numeric(12,2),
  add column if not exists pricing_margin_pct numeric(5,2),
  add column if not exists pricing_snapshot jsonb,
  add column if not exists pricing_calculated_at timestamptz;

alter table public.order_3d_details
  drop constraint if exists order_3d_details_estimated_material_nonnegative,
  drop constraint if exists order_3d_details_labor_minutes_nonnegative,
  drop constraint if exists order_3d_details_material_cost_nonnegative,
  drop constraint if exists order_3d_details_energy_cost_nonnegative,
  drop constraint if exists order_3d_details_machine_cost_nonnegative,
  drop constraint if exists order_3d_details_labor_cost_nonnegative,
  drop constraint if exists order_3d_details_estimated_cost_nonnegative,
  drop constraint if exists order_3d_details_suggested_price_nonnegative,
  drop constraint if exists order_3d_details_final_price_nonnegative,
  drop constraint if exists order_3d_details_pricing_margin_range;

alter table public.order_3d_details
  add constraint order_3d_details_estimated_material_nonnegative check (estimated_material_g is null or estimated_material_g >= 0),
  add constraint order_3d_details_labor_minutes_nonnegative check (labor_minutes is null or labor_minutes >= 0),
  add constraint order_3d_details_material_cost_nonnegative check (material_cost is null or material_cost >= 0),
  add constraint order_3d_details_energy_cost_nonnegative check (energy_cost is null or energy_cost >= 0),
  add constraint order_3d_details_machine_cost_nonnegative check (machine_cost is null or machine_cost >= 0),
  add constraint order_3d_details_labor_cost_nonnegative check (labor_cost is null or labor_cost >= 0),
  add constraint order_3d_details_estimated_cost_nonnegative check (estimated_cost is null or estimated_cost >= 0),
  add constraint order_3d_details_suggested_price_nonnegative check (suggested_price is null or suggested_price >= 0),
  add constraint order_3d_details_final_price_nonnegative check (final_price is null or final_price >= 0),
  add constraint order_3d_details_pricing_margin_range check (pricing_margin_pct is null or (pricing_margin_pct >= 0 and pricing_margin_pct < 100));
