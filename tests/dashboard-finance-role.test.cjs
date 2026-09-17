const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('KPIs financeiros expandidos do dashboard ficam restritos a admin', () => {
  const reports = fs.readFileSync('js/reports.js', 'utf8');
  assert.match(reports, /await\s+baseDashboard\(\);\s*if\(!S\.canAdmin\(\)\)return;/s,
    'wrapper de relatórios deve encerrar após o dashboard base para perfis sem acesso financeiro');
});
