const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('production_update offline valida a organização antes de ler estado do pedido', () => {
  const migrations = fs.readdirSync('supabase/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(`supabase/migrations/${name}`, 'utf8'))
    .join('\n');

  const fixes = [...migrations.matchAll(/create or replace function private\.apply_offline_mutation_impl[\s\S]*?end \$\$;/gi)];
  assert.ok(fixes.length > 0, 'a função apply_offline_mutation_impl deve existir');
  const latest = fixes.at(-1)[0];

  assert.match(latest,
    /from public\.orders\s+where id\s*=\s*v_entity\s+and organization_id\s*=\s*p_org/i,
    'production_update deve confirmar que o pedido pertence à organização do chamador');
  assert.match(latest,
    /from public\.order_production\s+where order_id\s*=\s*v_entity\s+and organization_id\s*=\s*p_org/i,
    'a leitura do estado de produção deve ser limitada à organização do chamador');
});
