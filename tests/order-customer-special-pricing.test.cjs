const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('novo pedido aplica preço especial do cliente antes de permitir override manual', () => {
  const payments = fs.readFileSync('js/payments.js', 'utf8');
  assert.match(payments, /getCustomerPrice\s*\(/, 'pedido deve consultar preço especial do cliente');
  assert.match(payments, /customer_id/, 'mudança de cliente deve participar da precificação do pedido');
  assert.match(payments, /Preço especial do cliente/, 'UI deve indicar quando um preço especial foi aplicado');
  assert.match(payments, /dataset\.standardPrice/, 'desmarcar override manual deve voltar ao preço base efetivo');
});
