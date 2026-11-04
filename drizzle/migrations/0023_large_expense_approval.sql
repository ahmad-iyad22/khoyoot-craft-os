ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS approval_threshold numeric NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS approvals_required integer NOT NULL DEFAULT 2;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.partner_transactions ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved', ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.expenses ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE TABLE public.expense_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind text NOT NULL CHECK (record_kind IN ('expense','partner_txn')),
  record_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  comment text,
  UNIQUE (record_kind, record_id, partner_id)
);
GRANT SELECT ON public.expense_approvals TO authenticated;
GRANT ALL ON public.expense_approvals TO service_role;
ALTER TABLE public.expense_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read approvals" ON public.expense_approvals FOR SELECT TO authenticated USING (public.is_owner());
CREATE TRIGGER audit_expense_approvals AFTER INSERT OR UPDATE OR DELETE ON public.expense_approvals FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

CREATE OR REPLACE FUNCTION public.set_approval_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _th numeric; _amt numeric;
BEGIN
  IF TG_TABLE_NAME='partner_transactions' AND NEW.txn_type<>'paid_on_behalf' THEN NEW.approval_status:='approved'; RETURN NEW; END IF;
  SELECT approval_threshold INTO _th FROM app_settings LIMIT 1;
  _amt := COALESCE(NEW.base_amount, NEW.amount*COALESCE(NEW.fx_rate_to_base,1));
  NEW.approval_status := CASE WHEN COALESCE(_th,0)>0 AND _amt>_th THEN 'pending' ELSE 'approved' END;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_expense_approval BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_approval_status();
CREATE TRIGGER zz_ptxn_approval BEFORE INSERT ON public.partner_transactions FOR EACH ROW EXECUTE FUNCTION public.set_approval_status();

CREATE OR REPLACE FUNCTION public._recount_approval(_kind text, _id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _req int; _ok int; _rej int; _st text;
BEGIN
  SELECT approvals_required INTO _req FROM app_settings LIMIT 1;
  SELECT count(*) FILTER (WHERE decision='approve'), count(*) FILTER (WHERE decision='reject') INTO _ok,_rej FROM expense_approvals WHERE record_kind=_kind AND record_id=_id;
  _st := CASE WHEN _rej>0 THEN 'rejected' WHEN _ok>=GREATEST(COALESCE(_req,2),1) THEN 'approved' ELSE 'pending' END;
  IF _kind='expense' THEN UPDATE expenses SET approval_status=_st WHERE id=_id;
  ELSE UPDATE partner_transactions SET approval_status=_st WHERE id=_id; END IF;
  RETURN _st;
END $$;
REVOKE ALL ON FUNCTION public._recount_approval(text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.decide_approval(_kind text, _id uuid, _decision text, _comment text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _pid uuid; _creator uuid; _payer uuid; _st text;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT id INTO _pid FROM partners WHERE profile_id=auth.uid() LIMIT 1;
  IF _pid IS NULL THEN RAISE EXCEPTION 'APPROVAL_NOT_LINKED'; END IF;
  IF _kind='expense' THEN SELECT created_by, paid_by_partner_id, approval_status INTO _creator,_payer,_st FROM expenses WHERE id=_id;
  ELSIF _kind='partner_txn' THEN SELECT created_by, partner_id, approval_status INTO _creator,_payer,_st FROM partner_transactions WHERE id=_id;
  ELSE RAISE EXCEPTION 'BAD_KIND'; END IF;
  IF _st IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF _st<>'pending' THEN RAISE EXCEPTION 'APPROVAL_CLOSED'; END IF;
  IF _creator=auth.uid() OR _payer=_pid THEN RAISE EXCEPTION 'APPROVAL_OWN'; END IF;
  INSERT INTO expense_approvals(record_kind,record_id,partner_id,decision,comment) VALUES (_kind,_id,_pid,_decision,_comment)
  ON CONFLICT (record_kind,record_id,partner_id) DO UPDATE SET decision=EXCLUDED.decision, comment=EXCLUDED.comment, decided_at=now();
  RETURN public._recount_approval(_kind,_id);
END $$;
GRANT EXECUTE ON FUNCTION public.decide_approval(text,uuid,text,text) TO authenticated;

-- Exclude non-approved rows from month-end, dashboard and budget numbers
DO $$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['month_statement_base','dashboard_summary','category_budget_status'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.proname=f AND p.pronamespace='public'::regnamespace;
    d := replace(d, 'FROM expenses e,', 'FROM (SELECT * FROM public.expenses WHERE approval_status=''approved'') e,');
    d := replace(d, 'JOIN public.expenses e ON', 'JOIN (SELECT * FROM public.expenses WHERE approval_status=''approved'') e ON');
    d := replace(d, 'FROM public.expenses WHERE', 'FROM public.expenses WHERE approval_status=''approved'' AND');
    d := replace(d, 'FROM public.partner_transactions t WHERE', 'FROM public.partner_transactions t WHERE t.approval_status=''approved'' AND');
    d := replace(d, 'FROM public.partner_transactions WHERE', 'FROM public.partner_transactions WHERE approval_status=''approved'' AND');
    EXECUTE d;
  END LOOP;
END $$;