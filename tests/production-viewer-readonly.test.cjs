const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('viewer vê detalhes de produção sem controles de gravação', () => {
  const guard = fs.readFileSync('js/production-readonly-guard.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(guard, /data-modular-form=["']production["']/, 'guard deve reconhecer modal de produção');
  assert.match(guard, /if\(S\.canWrite\(\)\)return;/, 'perfis com escrita devem sair antes de aplicar o modo leitura');
  assert.match(guard, /disabled\s*=\s*true/, 'campos precisam ficar realmente desabilitados');
  assert.match(guard, /button\[type=["']submit["']\]/, 'botão de salvar deve ser removido ou desabilitado');
  assert.match(index, /js\/production-readonly-guard\.js/);
  assert.match(sw, /js\/production-readonly-guard\.js/);
});
