const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('backup v2 exporta e restaura quote_status_history', () => {
  const backup = fs.readFileSync('js/backup-modular.js', 'utf8');
  assert.match(backup, /quote_status_history/);

  const migrationPath = 'supabase/migrations/20260917123000_quote_status_history_backup_restore.sql';
  assert.equal(fs.existsSync(migrationPath), true, 'migração de restauração do histórico deve existir');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  for (const marker of [
    "p_backup->'quote_status_history'",
    'delete from public.quote_status_history',
    'insert into public.quote_status_history',
    'restore_workspace_backup_v2'
  ]) assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
