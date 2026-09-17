const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('restauração v2 preserva configuração e snapshot da precificação 3D', () => {
  const sql = fs.readFileSync('supabase/migrations/20260917114429_automatic_3d_pricing_backup_restore.sql', 'utf8');
  for (const marker of [
    'electricity_price_per_kwh',
    'printer_power_watts',
    'machine_hour_cost',
    'labor_hour_cost',
    'default_3d_margin_pct',
    'estimated_material_g',
    'suggested_price',
    'final_price',
    'pricing_snapshot',
    'restore_workspace_backup_v2'
  ]) assert.match(sql, new RegExp(marker));
});
