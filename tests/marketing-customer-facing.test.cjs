const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('página de divulgação fala com clientes e evita detalhes internos', () => {
  const html = fs.readFileSync('marketing.html', 'utf8').toLowerCase();

  for (const expected of [
    'pagamentos parciais',
    'orçamentos',
    'produção',
    'impressão 3d',
    'documentos',
    'backup e restauração'
  ]) assert.equal(html.includes(expected), true, `deve destacar: ${expected}`);

  for (const internal of [
    'row level security',
    'postgresql',
    'csp',
    'hsts',
    'oauth',
    'snapshot json',
    'credencial pública',
    'api oficial em etapa futura'
  ]) assert.equal(html.includes(internal), false, `não deve expor detalhe interno: ${internal}`);
});
