-- Partial payments are modeled as separate paid income transactions.
-- The payment summary trigger already sums all active paid income rows per order,
-- so the legacy one-income-per-order uniqueness constraint is incompatible with
-- the current partial-payment flow.

drop index if exists public.financial_one_order_income_idx;
