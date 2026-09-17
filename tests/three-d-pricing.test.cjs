const test = require('node:test');
const assert = require('node:assert/strict');

const { calculate3DPricing } = require('../js/three-d-pricing.js');

test('calcula custos e aplica margem real sobre o preço final', () => {
  const result = calculate3DPricing({
    material_g: 200,
    material_cost_per_g: 0.10,
    print_minutes: 600,
    printer_power_watts: 200,
    electricity_price_per_kwh: 1,
    machine_hour_cost: 2,
    labor_minutes: 120,
    labor_hour_cost: 15,
    margin_pct: 30
  });

  assert.equal(result.material_cost, 20);
  assert.equal(result.energy_cost, 2);
  assert.equal(result.machine_cost, 20);
  assert.equal(result.labor_cost, 30);
  assert.equal(result.estimated_cost, 72);
  assert.equal(result.suggested_price, 102.86);
  assert.equal(result.final_price, 102.86);
  assert.ok(Math.abs(((result.suggested_price - result.estimated_cost) / result.suggested_price) * 100 - 30) < 0.01);
});

test('mantém preço final manual quando informado', () => {
  const result = calculate3DPricing({
    material_g: 100,
    material_cost_per_g: 0.20,
    print_minutes: 60,
    printer_power_watts: 100,
    electricity_price_per_kwh: 1,
    machine_hour_cost: 2,
    labor_minutes: 30,
    labor_hour_cost: 20,
    margin_pct: 25,
    final_price: 55
  });

  assert.equal(result.suggested_price, 42.80);
  assert.equal(result.final_price, 55);
});

test('rejeita custos negativos e margem inválida', () => {
  assert.throws(() => calculate3DPricing({ material_g: -1 }), /não pode ser negativo/i);
  assert.throws(() => calculate3DPricing({ margin_pct: 100 }), /menor que 100/i);
});
