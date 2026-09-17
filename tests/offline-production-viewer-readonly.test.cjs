const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('viewer não enfileira alterações de produção offline', () => {
  const guard = fs.readFileSync('js/offline-viewer-readonly-guard.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(guard, /if\(navigator\.onLine\|\|S\.canWrite\(\)\)return/, 'somente viewer offline deve receber o bloqueio de escrita');
  assert.match(guard, /offline-production/);
  assert.match(guard, /disabled\s*=\s*true/);
  assert.match(index, /js\/offline-viewer-readonly-guard\.js/);
  assert.match(sw, /js\/offline-viewer-readonly-guard\.js/);
});
