const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('documentos respeitam permissões de escrita e financeiro', () => {
  const guard = fs.readFileSync('js/document-permission-guard.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(guard, /!S\.canWrite\(\)/, 'viewer não deve gerar documentos persistidos');
  assert.match(guard, /type\s*===\s*["']receipt["']\s*&&\s*!S\.canAdmin\(\)/, 'recibo com histórico financeiro deve ser admin-only');
  assert.match(guard, /doc-receipt/);
  assert.match(index, /js\/document-permission-guard\.js/);
  assert.match(sw, /js\/document-permission-guard\.js/);
});
