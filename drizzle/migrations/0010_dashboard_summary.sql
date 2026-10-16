CREATE OR REPLACE FUNCTION public.dashboard_summary(_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _st text[]; _months jsonb := '[]'::jsonb; _m date; _s date; _e date; _sum jsonb; _start6 date; _end date;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT counting_statuses INTO _st FROM public.app_settings LIMIT 1;
  _st := COALESCE(_st, '{delivered,completed}');
  FOR i IN REVERSE 5..0 LOOP
    _m := (date_trunc('month', _month) - make_interval(months => i))::date;
    _s := _m; _e := (_m + interval '1 month')::date;
    _sum := public.partner_month_summary(_m);
    _months := _months || jsonb_build_object(
      'month', to_char(_m,'YYYY-MM'),
      'revenue', COALESCE((SELECT ROUND(SUM(net_revenue),2) FROM public.order_line_profit WHERE order_date >= _s AND order_date < _e AND status = ANY(_st)),0),
      'orders', (SELECT COUNT(DISTINCT order_id) FROM public.order_line_profit WHERE order_date >= _s AND order_date < _e AND status = ANY(_st)),
      'order_profit', _sum->'order_profit', 'losses', _sum->'losses', 'unallocated', _sum->'unallocated_profit',
      'net_profit', COALESCE((SELECT ROUND(SUM((p->>'net_share')::numeric),2) FROM jsonb_array_elements(_sum->'partners') p),0),
      'shared_costs', COALESCE((SELECT ROUND(SUM(COALESCE(base_amount, amount)),2) FROM public.expenses WHERE is_shared AND entry_date >= _s AND entry_date < _e),0));
  END LOOP;
  _start6 := date_trunc('month', _month)::date; _end := (_start6 + interval '1 month')::date;
  RETURN jsonb_build_object('months', _months, 'top', COALESCE((SELECT jsonb_agg(t) FROM (
    SELECT pr.name, ROUND(SUM(l.profit),2) profit FROM public.order_line_profit l JOIN public.products pr ON pr.id = l.product_id
    WHERE l.order_date >= _start6 AND l.order_date < _end AND l.status = ANY(_st)
    GROUP BY pr.name ORDER BY 2 DESC LIMIT 5) t), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.dashboard_summary(date) TO authenticated;