ALTER TABLE public.app_settings ADD COLUMN capital_return_percent_of_profit numeric NOT NULL DEFAULT 100 CHECK (capital_return_percent_of_profit BETWEEN 0 AND 100), ADD COLUMN reserve_percent numeric NOT NULL DEFAULT 0 CHECK (reserve_percent BETWEEN 0 AND 100);
ALTER TABLE public.partner_transactions ADD COLUMN is_capital boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.capital_distribution(_pool numeric, _capital_pct numeric, _reserve_pct numeric, _caps jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE _total numeric; _return numeric; _reserve numeric; _row jsonb; _parts jsonb := '[]'; _v numeric; _assigned numeric:=0; _i integer:=0; _count integer;
BEGIN
 IF _capital_pct IS NULL OR _reserve_pct IS NULL OR _capital_pct NOT BETWEEN 0 AND 100 OR _reserve_pct NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'CAPITAL_RATE_INVALID'; END IF;
 SELECT COALESCE(SUM(GREATEST((x->>'outstanding')::numeric,0)),0), count(*) INTO _total,_count FROM jsonb_array_elements(_caps) x;
 _return:=ROUND(LEAST(_total,GREATEST(_pool,0)*_capital_pct/100),2);
 _reserve:=CASE WHEN _pool>0 THEN ROUND((_pool-_return)*_reserve_pct/100,2) ELSE 0 END;
 FOR _row IN SELECT x FROM jsonb_array_elements(_caps) x ORDER BY GREATEST((x->>'outstanding')::numeric,0), x->>'partner_id' LOOP
  _i:=_i+1;
  _v:=CASE WHEN _total=0 THEN 0 WHEN _i=_count THEN _return-_assigned ELSE LEAST(GREATEST((_row->>'outstanding')::numeric,0),ROUND(_return*GREATEST((_row->>'outstanding')::numeric,0)/_total,2)) END;
  _assigned:=_assigned+_v;
  _parts:=_parts||jsonb_build_array(_row||jsonb_build_object('capital_returned',_v,'capital_outstanding',GREATEST((_row->>'outstanding')::numeric-_v,0)));
 END LOOP;
 RETURN jsonb_build_object('capital_return',_return,'reserve_kept',_reserve,'distributable',_pool-_return-_reserve,'partners',_parts);
END $$;
CREATE OR REPLACE FUNCTION public.month_statement(_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _start date:=date_trunc('month',_month)::date; _end date:=(_start+interval '1 month')::date; _prev date:=(_start-interval '1 month')::date;
 _sum jsonb; _clo record; _pclo record; _p record; _ps jsonb; _row jsonb; _parts jsonb:='[]'; _caps jsonb; _cap jsonb; _plan jsonb;
 _pool numeric; _scale numeric:=1; _cr numeric; _rp numeric; _return numeric:=0; _reserve numeric:=0;
 _pob numeric; _wd numeric; _otm numeric; _owe numeric; _carry numeric; _final numeric; _settled numeric; _cash numeric; _pending numeric; _payouts numeric:=0;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 SELECT * INTO _clo FROM public.month_closures WHERE month=_start;
 SELECT * INTO _pclo FROM public.month_closures WHERE month=_prev;
 _sum:=public.partner_month_summary(_start);
 IF _clo.id IS NULL THEN
  SELECT capital_return_percent_of_profit,reserve_percent INTO _cr,_rp FROM public.app_settings WHERE id;
  _pool:=COALESCE((_sum->>'order_profit')::numeric,0)-COALESCE((_sum->>'losses')::numeric,0);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('partner_id',p.id,'contributed',c.v,'returned',r.v,'outstanding',GREATEST(c.v-r.v,0)) ORDER BY p.id),'[]') INTO _caps
  FROM public.partners p
  CROSS JOIN LATERAL (SELECT COALESCE(SUM(COALESCE(t.base_amount,t.amount)),0) v FROM public.partner_transactions t WHERE t.partner_id=p.id AND t.txn_type='contribution' AND t.is_capital AND t.txn_date<_end) c
  CROSS JOIN LATERAL (SELECT COALESCE(SUM((x->>'capital_returned')::numeric),0) v FROM public.month_closures mc CROSS JOIN LATERAL jsonb_array_elements(mc.snapshot->'partners') x WHERE mc.month<_start AND x->>'partner_id'=p.id::text) r;
  _plan:=public.capital_distribution(_pool,COALESCE(_cr,100),COALESCE(_rp,0),_caps);
  _return:=(_plan->>'capital_return')::numeric; _reserve:=(_plan->>'reserve_kept')::numeric;
  IF _pool>0 THEN _scale:=(_plan->>'distributable')::numeric/_pool; END IF;
 END IF;
 FOR _p IN SELECT id,name FROM public.partners ORDER BY name LOOP
  IF _clo.id IS NOT NULL THEN
   SELECT x INTO _row FROM jsonb_array_elements(_clo.snapshot->'partners') x WHERE x->>'partner_id'=_p.id::text;
  ELSE
   SELECT x INTO _ps FROM jsonb_array_elements(_sum->'partners') x WHERE x->>'partner_id'=_p.id::text;
   SELECT x INTO _cap FROM jsonb_array_elements(_plan->'partners') x WHERE x->>'partner_id'=_p.id::text;
   SELECT COALESCE(SUM(COALESCE(base_amount,amount)) FILTER(WHERE txn_type='paid_on_behalf'),0),COALESCE(SUM(COALESCE(base_amount,amount)) FILTER(WHERE txn_type='withdrawal'),0) INTO _pob,_wd FROM public.partner_transactions WHERE partner_id=_p.id AND txn_date>=_start AND txn_date<_end;
   SELECT COALESCE(SUM(s.share_amount*e.fx_rate_to_base),0) INTO _otm FROM public.expense_splits s JOIN public.expenses e ON e.id=s.expense_id WHERE e.is_shared AND NOT e.paid_by_business AND e.paid_by_partner_id=_p.id AND s.partner_id<>_p.id AND e.entry_date>=_start AND e.entry_date<_end;
   SELECT COALESCE(SUM(s.share_amount*e.fx_rate_to_base),0) INTO _owe FROM public.expense_splits s JOIN public.expenses e ON e.id=s.expense_id WHERE e.is_shared AND s.partner_id=_p.id AND (e.paid_by_business OR e.paid_by_partner_id IS DISTINCT FROM _p.id) AND e.entry_date>=_start AND e.entry_date<_end;
   _carry:=0;
   IF _pclo.id IS NOT NULL THEN
    SELECT COALESCE((x->>'final')::numeric,0) INTO _carry FROM jsonb_array_elements(_pclo.snapshot->'partners') x WHERE x->>'partner_id'=_p.id::text;
    _carry:=COALESCE(_carry,0)-COALESCE((SELECT SUM(COALESCE(base_amount,amount)) FROM public.partner_transactions WHERE partner_id=_p.id AND txn_type='settlement' AND settles_month=_prev),0);
   END IF;
   _final:=ROUND(COALESCE((_ps->>'profit_share')::numeric,0)*_scale,2)-ROUND(COALESCE((_ps->>'loss_share')::numeric,0)*_scale,2)+COALESCE((_cap->>'capital_returned')::numeric,0)+COALESCE((_ps->>'item_cost_owed')::numeric,0)+_pob+_otm-_owe-_wd+_carry;
   _row:=jsonb_build_object('partner_id',_p.id,'name',_p.name,'profit_share',ROUND(COALESCE((_ps->>'profit_share')::numeric,0)*_scale,2),'loss_share',ROUND(COALESCE((_ps->>'loss_share')::numeric,0)*_scale,2),'capital_contributed',COALESCE((_cap->>'contributed')::numeric,0),'capital_returned',COALESCE((_cap->>'capital_returned')::numeric,0),'capital_outstanding',COALESCE((_cap->>'capital_outstanding')::numeric,0),'item_cost_owed',COALESCE((_ps->>'item_cost_owed')::numeric,0),'paid_on_behalf',ROUND(_pob,2),'owed_to_them',ROUND(_otm,2),'they_owe',ROUND(_owe,2),'withdrawals',ROUND(_wd,2),'carry_in',ROUND(_carry,2),'final',ROUND(_final,2));
  END IF;
  _settled:=COALESCE((SELECT SUM(COALESCE(base_amount,amount)) FROM public.partner_transactions WHERE partner_id=_p.id AND txn_type='settlement' AND settles_month=_start),0);
  _row:=COALESCE(_row,jsonb_build_object('partner_id',_p.id,'name',_p.name,'final',0))||jsonb_build_object('settled',ROUND(_settled,2),'remaining',ROUND(COALESCE((_row->>'final')::numeric,0)-_settled,2));
  _payouts:=_payouts+GREATEST(COALESCE((_row->>'final')::numeric,0)-_settled,0); _parts:=_parts||jsonb_build_array(_row); _row:=NULL; _ps:=NULL;
 END LOOP;
 SELECT COALESCE(SUM(balance_base) FILTER(WHERE kind<>'platform_wallet'),0),COALESCE(SUM(pending_payout) FILTER(WHERE kind='platform_wallet'),0) INTO _cash,_pending FROM public.bank_account_balances;
 RETURN jsonb_build_object('month',to_char(_start,'YYYY-MM'),'closed',_clo.id IS NOT NULL,'closed_at',_clo.closed_at,'previous_closed',_pclo.id IS NOT NULL,'unallocated_profit',CASE WHEN _clo.id IS NOT NULL THEN COALESCE(_clo.snapshot->'unallocated_profit','0') ELSE to_jsonb(COALESCE((_sum->>'unallocated_profit')::numeric,0)*_scale) END,'capital_return',CASE WHEN _clo.id IS NOT NULL THEN COALESCE(_clo.snapshot->'capital_return','0') ELSE to_jsonb(_return) END,'reserve_kept',CASE WHEN _clo.id IS NOT NULL THEN COALESCE(_clo.snapshot->'reserve_kept','0') ELSE to_jsonb(_reserve) END,'capital_return_percent_of_profit',CASE WHEN _clo.id IS NOT NULL THEN _clo.snapshot->'capital_return_percent_of_profit' ELSE to_jsonb(_cr) END,'reserve_percent',CASE WHEN _clo.id IS NOT NULL THEN _clo.snapshot->'reserve_percent' ELSE to_jsonb(_rp) END,'distribution_scale',CASE WHEN _clo.id IS NOT NULL THEN COALESCE(_clo.snapshot->'distribution_scale','1') ELSE to_jsonb(_scale) END,'partners',_parts,'cash',jsonb_build_object('available',ROUND(_cash,2),'pending_payouts',ROUND(_pending,2),'payouts',ROUND(_payouts,2),'shortfall',ROUND(GREATEST(_payouts-_cash,0),2)));
END $$;
CREATE OR REPLACE FUNCTION public.close_month(_month date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _start date:=date_trunc('month',_month)::date;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 PERFORM pg_advisory_xact_lock(771101);
 IF EXISTS(SELECT 1 FROM public.month_closures WHERE month>_start) THEN RAISE EXCEPTION 'CAPITAL_CLOSE_ORDER'; END IF;
 IF EXISTS(SELECT 1 FROM public.month_closures WHERE month=_start) THEN RAISE EXCEPTION 'ALREADY_CLOSED'; END IF;
 INSERT INTO public.month_closures(month,snapshot,closed_by) VALUES(_start,public.month_statement(_start),auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.reopen_month(_month date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 PERFORM pg_advisory_xact_lock(771101);
 IF EXISTS(SELECT 1 FROM public.month_closures WHERE month>date_trunc('month',_month)::date) THEN RAISE EXCEPTION 'CAPITAL_REOPEN_ORDER'; END IF;
 DELETE FROM public.month_closures WHERE month=date_trunc('month',_month)::date;
END $$;