const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('backup v2 exporta e restaura quote_status_history sem quebrar backups v2 antigos', () => {
  const backup = fs.readFileSync('js/backup-modular.js', 'utf8');
  assert.match(backup, /quote_status_history/);
  assert.match(backup, /snapshot\.quote_status_history/);
  assert.equal(backup.includes("t==='quote_status_history'?'changed_at':'created_at'"), true, 'histórico deve ser exportado ordenando por changed_at');

  const migrationPath = 'supabase/migrations/20260917125950_quote_status_history_backup_restore.sql';
  assert.equal(fs.existsSync(migrationPath), true, 'migração de restauração do histórico deve existir com a mesma versão aplicada no Supabase');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  for (const marker of [
    "p_backup ? 'quote_status_history'",
    "p_backup->'quote_status_history'",
    'delete from public.quote_status_history',
    'insert into public.quote_status_history',
    'changed_by',
    'changed_at',
    'restore_workspace_backup_v2'
  ]) assert.equal(migration.includes(marker), true, `migração deve conter: ${marker}`);
});
