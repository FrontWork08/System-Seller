const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('viewer consulta conflitos offline sem controles de resolução', () => {
  const guard = fs.readFileSync('js/sync-conflicts-readonly-guard.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(guard, /if\(S\.canWrite\(\)\)return;/, 'perfis com escrita devem manter os controles de resolução');
  assert.match(guard, /conflict-apply-offline/);
  assert.match(guard, /conflict-keep-server/);
  assert.match(index, /js\/sync-conflicts-readonly-guard\.js/);
  assert.match(sw, /js\/sync-conflicts-readonly-guard\.js/);
});
