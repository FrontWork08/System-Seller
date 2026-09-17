const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('relatórios convertem limites do período usando o fuso configurado', () => {
  const reports = fs.readFileSync('js/reports.js', 'utf8');
  assert.match(reports, /S\.zonedInputToIso\(range\.start\+'T00:00'\)/,
    'início do período deve ser convertido do horário local da empresa');
  assert.match(reports, /S\.zonedInputToIso\(nextDay\(range\.end\)\+'T00:00'\)/,
    'fim deve usar meia-noite local do dia seguinte');
  assert.match(reports, /\.lt\('sold_at',end\)/,
    'consulta deve usar limite superior exclusivo para não perder milissegundos');
});
