const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('multiple partial payments are not blocked by the legacy one-income-per-order index', () => {
  const migrationPath = 'supabase/migrations/20260917161558_allow_multiple_partial_payments.sql';
  assert.equal(fs.existsSync(migrationPath), true, 'migration allowing multiple payments must exist');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /drop index if exists public\.financial_one_order_income_idx/i);
  assert.doesNotMatch(migration, /create\s+unique\s+index[\s\S]*financial_one_order_income_idx/i);
});
