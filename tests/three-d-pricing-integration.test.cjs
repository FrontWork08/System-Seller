const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('carrega o cálculo 3D no app e no service worker', () => {
  const html = read('index.html');
  const sw = read('service-worker.js');
  for (const file of ['js/three-d-pricing.js', 'js/three-d-pricing-ui.js']) {
    assert.match(html, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(sw, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('expõe configuração por empresa e cálculo aplicável a pedido e orçamento', () => {
  const ui = read('js/three-d-pricing-ui.js');
  for (const marker of [
    'electricity_price_per_kwh',
    'printer_power_watts',
    'machine_hour_cost',
    'labor_hour_cost',
    'default_3d_margin_pct',
    '.order-line',
    '.quote-line',
    'Preço sugerido',
    'Preço final',
    'order_3d_details'
  ]) assert.match(ui, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('versiona a migração de precificação 3D', () => {
  const migration = read('supabase/migrations/20260917113957_automatic_3d_pricing.sql');
  for (const marker of [
    'electricity_price_per_kwh',
    'printer_power_watts',
    'estimated_material_g',
    'suggested_price',
    'final_price',
    'pricing_snapshot'
  ]) assert.match(migration, new RegExp(marker));
});
