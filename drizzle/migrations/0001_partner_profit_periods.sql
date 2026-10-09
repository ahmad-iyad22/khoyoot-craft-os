ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
CREATE TABLE public.partner_profit_periods (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), period_start date NOT NULL, period_end date NOT NULL, net_profit numeric(14,2) NOT NULL CHECK(net_profit >= 0), shares jsonb NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT now(), CHECK(period_end >= period_start));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_profit_periods TO authenticated;
GRANT ALL ON public.partner_profit_periods TO service_role;
ALTER TABLE public.partner_profit_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_profit_periods ON public.partner_profit_periods FOR ALL TO authenticated USING(public.is_owner()) WITH CHECK(public.is_owner());
ALTER TABLE public.partner_transactions ADD COLUMN IF NOT EXISTS profit_period_id uuid REFERENCES public.partner_profit_periods(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.save_partner_profit_period(_id uuid, _start date, _end date, _profit numeric, _shares jsonb, _notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_share jsonb; v_total numeric; v_amount numeric; v_allocated numeric := 0; v_count integer; v_index integer := 0;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF _profit < 0 OR _profit <> round(_profit,2) OR _end < _start THEN RAISE EXCEPTION 'Invalid period or profit'; END IF;
 SELECT sum((x->>'percent')::numeric), count(*) INTO v_total,v_count FROM jsonb_array_elements(_shares) x;
 IF v_total IS DISTINCT FROM 100 OR v_count < 2 THEN RAISE EXCEPTION 'Shares must total 100 percent'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_shares) x WHERE (x->>'percent')::numeric < 0 OR (x->>'percent')::numeric > 100 OR NOT EXISTS(SELECT 1 FROM public.partners p WHERE p.id=(x->>'partner_id')::uuid)) OR (SELECT count(DISTINCT x->>'partner_id') FROM jsonb_array_elements(_shares) x) <> v_count THEN RAISE EXCEPTION 'Invalid partner allocation'; END IF;
 IF _id IS NULL THEN INSERT INTO public.partner_profit_periods(period_start,period_end,net_profit,shares,notes) VALUES(_start,_end,_profit,_shares,_notes) RETURNING id INTO v_id;
 ELSE UPDATE public.partner_profit_periods SET period_start=_start,period_end=_end,net_profit=_profit,shares=_shares,notes=_notes WHERE id=_id RETURNING id INTO v_id; IF v_id IS NULL THEN RAISE EXCEPTION 'Period not found'; END IF; DELETE FROM public.partner_transactions WHERE profit_period_id=v_id; END IF;
 FOR v_share IN SELECT value FROM jsonb_array_elements(_shares) LOOP
  v_index := v_index+1; v_amount := CASE WHEN v_index=v_count THEN _profit-v_allocated ELSE round(_profit*(v_share->>'percent')::numeric/100,2) END; v_allocated := v_allocated+v_amount;
  INSERT INTO public.partner_transactions(partner_id,txn_type,amount,txn_date,notes,profit_period_id) VALUES((v_share->>'partner_id')::uuid,'profit_share',v_amount,_end,_notes,v_id);
 END LOOP;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_partner_profit_period(uuid,date,date,numeric,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_partner_profit_period(uuid,date,date,numeric,jsonb,text) TO authenticated,service_role;