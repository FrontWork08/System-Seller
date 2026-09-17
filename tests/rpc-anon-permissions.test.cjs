const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('RPCs operacionais não concedem execução ao papel anon', () => {
  const sql = fs.readFileSync('supabase/migrations/20260917181253_revoke_anon_app_rpc_execution.sql', 'utf8');
  const critical = ['create_order','create_order_with_payment','record_order_payment','restore_workspace_backup_v2','apply_offline_mutation','upsert_order_production','queue_business_email'];
  critical.forEach((name) => {
    assert.match(sql, new RegExp('revoke execute on function public\\.' + name + '\\([^;]*\\) from anon;', 'i'), name + ' deve revogar execução de anon');
  });
});
