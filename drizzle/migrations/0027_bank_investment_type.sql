ALTER TABLE public.bank_transactions DROP CONSTRAINT bank_transactions_txn_type_check;
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_txn_type_check CHECK (txn_type = ANY (ARRAY['deposit','investment','platform_payout','withdrawal','expense_payment','transfer','adjustment']));
CREATE OR REPLACE VIEW public.bank_account_balances WITH (security_invoker = true) AS
 SELECT id, name, kind, partner_id, currency, pending_payout, actual_balance, actual_checked_at,
    round(((opening_balance * opening_fx) + COALESCE(( SELECT sum(
      CASE
        WHEN t.txn_type = ANY (ARRAY['deposit','investment','platform_payout','adjustment']) AND t.account_id = a.id THEN t.base_amount
        WHEN t.txn_type = ANY (ARRAY['withdrawal','expense_payment']) AND t.account_id = a.id THEN - t.base_amount
        WHEN t.txn_type = 'transfer' AND t.account_id = a.id THEN - t.base_amount
        WHEN t.txn_type = 'transfer' AND t.to_account_id = a.id THEN t.base_amount
        ELSE 0::numeric END)
      FROM bank_transactions t WHERE t.account_id = a.id OR t.to_account_id = a.id), 0::numeric)), 2) AS balance_base,
    round((opening_balance + COALESCE(( SELECT sum(
      CASE
        WHEN t.txn_type = ANY (ARRAY['deposit','investment','platform_payout','adjustment']) AND t.account_id = a.id THEN t.amount
        WHEN t.txn_type = ANY (ARRAY['withdrawal','expense_payment','transfer']) AND t.account_id = a.id THEN - t.amount
        WHEN t.txn_type = 'transfer' AND t.to_account_id = a.id THEN t.base_amount / NULLIF(a.opening_fx, 0::numeric)
        ELSE 0::numeric END)
      FROM bank_transactions t WHERE t.account_id = a.id OR t.to_account_id = a.id), 0::numeric)), 2) AS balance_native
 FROM bank_accounts a;