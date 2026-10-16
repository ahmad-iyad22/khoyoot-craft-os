
ALTER TABLE public.partner_transactions ADD COLUMN IF NOT EXISTS settles_month date;

CREATE TABLE public.month_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  closed_by uuid,
  closed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.month_closures TO authenticated;
GRANT ALL ON public.month_closures TO service_role;
ALTER TABLE public.month_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closures owner read" ON public.month_closures FOR SELECT TO authenticated USING (public.is_owner());

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('business_bank','partner_cash','platform_wallet')),
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'MYR',
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_fx numeric NOT NULL DEFAULT 1,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  pending_payout numeric NOT NULL DEFAULT 0,
  actual_balance numeric,
  actual_checked_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank accounts owner" ON public.bank_accounts FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  to_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  txn_type text NOT NULL CHECK (txn_type IN ('deposit','platform_payout','withdrawal','expense_payment','transfer','adjustment')),
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'MYR',
  fx_rate_to_base numeric NOT NULL DEFAULT 1,
  base_amount numeric NOT NULL DEFAULT 0,
  note text,
  receipt_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank txns owner" ON public.bank_transactions FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TRIGGER bank_accounts_touch BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER bank_txns_touch BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_month_closures AFTER INSERT OR UPDATE OR DELETE ON public.month_closures FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_bank_transactions AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

CREATE OR REPLACE VIEW public.bank_account_balances WITH (security_invoker = true) AS
SELECT a.id, a.name, a.kind, a.partner_id, a.currency, a.pending_payout, a.actual_balance, a.actual_checked_at,
  ROUND(a.opening_balance * a.opening_fx + COALESCE((
    SELECT SUM(CASE
      WHEN t.txn_type IN ('deposit','platform_payout','adjustment') AND t.account_id = a.id THEN t.base_amount
      WHEN t.txn_type IN ('withdrawal','expense_payment') AND t.account_id = a.id THEN -t.base_amount
      WHEN t.txn_type = 'transfer' AND t.account_id = a.id THEN -t.base_amount
      WHEN t.txn_type = 'transfer' AND t.to_account_id = a.id THEN t.base_amount
      ELSE 0 END)
    FROM public.bank_transactions t WHERE t.account_id = a.id OR t.to_account_id = a.id), 0), 2) AS balance_base,
  ROUND(a.opening_balance + COALESCE((
    SELECT SUM(CASE
      WHEN t.txn_type IN ('deposit','platform_payout','adjustment') AND t.account_id = a.id THEN t.amount
      WHEN t.txn_type IN ('withdrawal','expense_payment','transfer') AND t.account_id = a.id THEN -t.amount
      WHEN t.txn_type = 'transfer' AND t.to_account_id = a.id THEN t.base_amount / NULLIF(a.opening_fx, 0)
      ELSE 0 END)
    FROM public.bank_transactions t WHERE t.account_id = a.id OR t.to_account_id = a.id), 0), 2) AS balance_native
FROM public.bank_accounts a;
GRANT SELECT ON public.bank_account_balances TO authenticated;

CREATE OR REPLACE FUNCTION public.month_statement(_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _start date := date_trunc('month', _month)::date; _end date; _prev date; _sum jsonb; _clo record; _pclo record;
  _p record; _ps jsonb; _snap jsonb; _parts jsonb := '[]'::jsonb; _row jsonb;
  _pob numeric; _wd numeric; _otm numeric; _owe numeric; _carry numeric; _final numeric; _settled numeric;
  _cash numeric; _pending numeric; _payouts numeric := 0;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  _end := (_start + interval '1 month')::date; _prev := (_start - interval '1 month')::date;
  SELECT * INTO _clo FROM public.month_closures WHERE month = _start;
  SELECT * INTO _pclo FROM public.month_closures WHERE month = _prev;
  _sum := public.partner_month_summary(_start);
  FOR _p IN SELECT id, name FROM public.partners ORDER BY name LOOP
    IF _clo.id IS NOT NULL THEN
      SELECT x INTO _row FROM jsonb_array_elements(_clo.snapshot->'partners') x WHERE x->>'partner_id' = _p.id::text;
    ELSE
      SELECT x INTO _ps FROM jsonb_array_elements(_sum->'partners') x WHERE x->>'partner_id' = _p.id::text;
      SELECT COALESCE(SUM(COALESCE(base_amount, amount)) FILTER (WHERE txn_type = 'paid_on_behalf'),0),
             COALESCE(SUM(COALESCE(base_amount, amount)) FILTER (WHERE txn_type = 'withdrawal'),0)
        INTO _pob, _wd FROM public.partner_transactions WHERE partner_id = _p.id AND txn_date >= _start AND txn_date < _end;
      SELECT COALESCE(SUM(s.share_amount * e.fx_rate_to_base),0) INTO _otm
        FROM public.expense_splits s JOIN public.expenses e ON e.id = s.expense_id
        WHERE e.is_shared AND NOT e.paid_by_business AND e.paid_by_partner_id = _p.id AND s.partner_id <> _p.id
          AND e.entry_date >= _start AND e.entry_date < _end;
      SELECT COALESCE(SUM(s.share_amount * e.fx_rate_to_base),0) INTO _owe
        FROM public.expense_splits s JOIN public.expenses e ON e.id = s.expense_id
        WHERE e.is_shared AND s.partner_id = _p.id AND (e.paid_by_business OR e.paid_by_partner_id IS DISTINCT FROM _p.id)
          AND e.entry_date >= _start AND e.entry_date < _end;
      _carry := 0;
      IF _pclo.id IS NOT NULL THEN
        SELECT COALESCE((x->>'final')::numeric,0) INTO _carry FROM jsonb_array_elements(_pclo.snapshot->'partners') x WHERE x->>'partner_id' = _p.id::text;
        _carry := COALESCE(_carry,0) - COALESCE((SELECT SUM(COALESCE(base_amount, amount)) FROM public.partner_transactions
          WHERE partner_id = _p.id AND txn_type = 'settlement' AND settles_month = _prev),0);
      END IF;
      _final := COALESCE((_ps->>'profit_share')::numeric,0) - COALESCE((_ps->>'loss_share')::numeric,0) + COALESCE((_ps->>'item_cost_owed')::numeric,0)
        + _pob + _otm - _owe - _wd + _carry;
      _row := jsonb_build_object('partner_id', _p.id, 'name', _p.name,
        'profit_share', COALESCE((_ps->>'profit_share')::numeric,0), 'loss_share', COALESCE((_ps->>'loss_share')::numeric,0),
        'item_cost_owed', COALESCE((_ps->>'item_cost_owed')::numeric,0), 'paid_on_behalf', ROUND(_pob,2), 'owed_to_them', ROUND(_otm,2),
        'they_owe', ROUND(_owe,2), 'withdrawals', ROUND(_wd,2), 'carry_in', ROUND(_carry,2), 'final', ROUND(_final,2));
    END IF;
    _settled := COALESCE((SELECT SUM(COALESCE(base_amount, amount)) FROM public.partner_transactions
      WHERE partner_id = _p.id AND txn_type = 'settlement' AND settles_month = _start),0);
    _row := COALESCE(_row, jsonb_build_object('partner_id', _p.id, 'name', _p.name, 'final', 0))
      || jsonb_build_object('settled', ROUND(_settled,2), 'remaining', ROUND(COALESCE((_row->>'final')::numeric,0) - _settled,2));
    _payouts := _payouts + GREATEST(COALESCE((_row->>'final')::numeric,0) - _settled, 0);
    _parts := _parts || jsonb_build_array(_row);
    _row := NULL; _ps := NULL;
  END LOOP;
  SELECT COALESCE(SUM(balance_base) FILTER (WHERE kind <> 'platform_wallet'),0), COALESCE(SUM(pending_payout) FILTER (WHERE kind = 'platform_wallet'),0)
    INTO _cash, _pending FROM public.bank_account_balances;
  RETURN jsonb_build_object('month', to_char(_start,'YYYY-MM'), 'closed', _clo.id IS NOT NULL, 'closed_at', _clo.closed_at,
    'previous_closed', _pclo.id IS NOT NULL,
    'unallocated_profit', COALESCE(CASE WHEN _clo.id IS NOT NULL THEN _clo.snapshot->'unallocated_profit' ELSE _sum->'unallocated_profit' END, '0'::jsonb),
    'partners', _parts,
    'cash', jsonb_build_object('available', ROUND(_cash,2), 'pending_payouts', ROUND(_pending,2), 'payouts', ROUND(_payouts,2),
      'shortfall', ROUND(GREATEST(_payouts - _cash, 0),2)));
END $$;

CREATE OR REPLACE FUNCTION public.close_month(_month date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _start date := date_trunc('month', _month)::date;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF EXISTS (SELECT 1 FROM public.month_closures WHERE month = _start) THEN RAISE EXCEPTION 'ALREADY_CLOSED'; END IF;
  INSERT INTO public.month_closures(month, snapshot, closed_by) VALUES (_start, public.month_statement(_start), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.reopen_month(_month date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  DELETE FROM public.month_closures WHERE month = date_trunc('month', _month)::date;
END $$;

CREATE OR REPLACE FUNCTION public.settle_partner(_month date, _partner_id uuid, _amount numeric, _date date, _receipt text, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _start date := date_trunc('month', _month)::date; _id uuid; _cur text;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.month_closures WHERE month = _start) THEN RAISE EXCEPTION 'MONTH_NOT_CLOSED'; END IF;
  IF COALESCE(_amount,0) = 0 THEN RAISE EXCEPTION 'Amount must not be zero'; END IF;
  SELECT base_currency INTO _cur FROM public.app_settings LIMIT 1;
  INSERT INTO public.partner_transactions(partner_id, txn_type, amount, txn_date, notes, currency, fx_rate_to_base, base_amount, receipt_path, settles_month)
  VALUES (_partner_id, 'settlement', _amount, COALESCE(_date, CURRENT_DATE), COALESCE(NULLIF(_notes,''), 'Settlement ' || to_char(_start,'YYYY-MM')),
    COALESCE(_cur,'MYR'), 1, _amount, NULLIF(_receipt,''), _start)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
