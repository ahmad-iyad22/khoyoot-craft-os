DO $$ DECLARE d text; BEGIN SELECT pg_get_functiondef('public.month_statement(date)'::regprocedure) INTO d; d:=replace(d,'FUNCTION public.month_statement(', 'FUNCTION public.month_statement_base('); EXECUTE d; END $$;
REVOKE ALL ON FUNCTION public.month_statement_base(date) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.month_statement(_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s jsonb; prev jsonb; earliest date; start_date date:=date_trunc('month',_month)::date; parts jsonb:='[]'; row jsonb; prior jsonb; carry numeric; final_value numeric; settled numeric; payouts numeric:=0;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 s:=public.month_statement_base(start_date);
 IF (s->>'closed')::boolean OR (s->>'previous_closed')::boolean THEN RETURN s; END IF;
 SELECT date_trunc('month',min(d))::date INTO earliest FROM (SELECT min(order_date) d FROM public.orders UNION ALL SELECT min(entry_date) FROM public.expenses UNION ALL SELECT min(loss_date) FROM public.stock_losses UNION ALL SELECT min(txn_date) FROM public.partner_transactions UNION ALL SELECT min(month) FROM public.month_closures) x;
 IF earliest IS NULL OR start_date<=earliest THEN RETURN s; END IF;
 prev:=public.month_statement((start_date-interval '1 month')::date);
 FOR row IN SELECT x FROM jsonb_array_elements(s->'partners') x LOOP
  SELECT x INTO prior FROM jsonb_array_elements(prev->'partners') x WHERE x->>'partner_id'=row->>'partner_id';
  carry:=COALESCE((prior->>'remaining')::numeric,0);
  final_value:=COALESCE((row->>'final')::numeric,0)-COALESCE((row->>'carry_in')::numeric,0)+carry;
  settled:=COALESCE((row->>'settled')::numeric,0);
  row:=row||jsonb_build_object('carry_in',round(carry,2),'final',round(final_value,2),'remaining',round(final_value-settled,2));
  parts:=parts||jsonb_build_array(row); payouts:=payouts+greatest(final_value-settled,0);
 END LOOP;
 RETURN s||jsonb_build_object('partners',parts,'carry_provisional',true,'cash',(s->'cash')||jsonb_build_object('payouts',round(payouts,2),'shortfall',round(greatest(payouts-COALESCE((s->'cash'->>'available')::numeric,0),0),2)));
END $$;