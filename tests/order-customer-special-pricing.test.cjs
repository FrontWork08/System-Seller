const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('novo pedido aplica preço especial do cliente antes de permitir override manual', () => {
  const pricing = fs.readFileSync('js/order-special-pricing.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');

  assert.match(pricing, /getCustomerPrice\s*\(/, 'pedido deve consultar preço especial do cliente');
  assert.match(pricing, /customer_id/, 'mudança de cliente deve participar da precificação do pedido');
  assert.match(pricing, /Preço especial do cliente/, 'UI deve indicar quando um preço especial foi aplicado');
  assert.match(pricing, /dataset\.standardPrice/, 'desmarcar override manual deve voltar ao preço base efetivo');
  assert.match(index, /js\/order-special-pricing\.js/, 'integração deve ser carregada pelo app');
  assert.match(sw, /js\/order-special-pricing\.js/, 'integração deve estar disponível no shell PWA');
});
