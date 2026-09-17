const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('service worker nunca devolve index.html para scripts e ignora query de versão no fallback do cache', () => {
  const sw = fs.readFileSync('service-worker.js', 'utf8');

  assert.match(sw, /ignoreSearch\s*:\s*true/,
    'assets versionados devem encontrar o shell em cache mesmo com ?v= diferente');
  assert.match(sw, /req\.destination\s*===\s*["']document["']|req\.mode\s*===\s*["']navigate["']/,
    'fallback para index.html deve ser restrito a navegação/documento');
  assert.doesNotMatch(sw, /cached\s*\|\|\s*caches\.match\(["']\/index\.html["']\)/,
    'assets não podem receber HTML como fallback');
});
