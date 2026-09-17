const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('viewer usa estoque 3D em modo somente leitura', () => {
  const guard = fs.readFileSync('js/inventory-3d-readonly-guard.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(guard, /if\(S\.canWrite\(\)\)return;/, 'perfis com escrita devem sair antes do bloqueio de leitura');
  assert.match(guard, /new-roll/);
  assert.match(guard, /consume-roll/);
  assert.match(guard, /edit-roll/);
  assert.match(guard, /order-3d/);
  assert.match(guard, /disabled\s*=\s*true/);
  assert.match(index, /js\/inventory-3d-readonly-guard\.js/);
  assert.match(sw, /js\/inventory-3d-readonly-guard\.js/);
});
