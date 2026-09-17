const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('viewer abre notificações sem tentar gravar alertas operacionais', () => {
  const guard = fs.readFileSync('js/notification-permission-guard.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(guard, /!S\.canWrite\(\)/, 'viewer deve pular a geração de notificações que exige escrita');
  assert.match(guard, /refreshOperationalNotifications/, 'guard deve proteger o refresh já usado pela página');
  assert.match(index, /js\/notification-permission-guard\.js/);
  assert.match(sw, /js\/notification-permission-guard\.js/);
});
