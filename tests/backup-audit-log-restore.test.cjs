const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('backup v2 preserva o histórico de auditoria durante a restauração', () => {
  const backup = fs.readFileSync('js/backup-modular.js', 'utf8');
  assert.match(backup, /audit_logs/, 'o exportador precisa incluir audit_logs');

  const migrations = fs.readdirSync('supabase/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(`supabase/migrations/${name}`, 'utf8'))
    .join('\n');

  assert.match(migrations, /delete from public\.audit_logs\s+where organization_id\s*=\s*p_organization_id/i,
    'a restauração deve substituir o histórico de auditoria da organização');
  assert.match(migrations, /insert into public\.audit_logs\s*\(/i,
    'a restauração deve reinserir os audit_logs exportados');
  assert.match(migrations, /jsonb_to_recordset\([^)]*p_backup->'audit_logs'/is,
    'a restauração deve ler audit_logs do backup');
});
