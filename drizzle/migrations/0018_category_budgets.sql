CREATE TABLE public.category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code text NOT NULL,
  month date,
  amount numeric NOT NULL CHECK (amount >= 0),
  warn_at_percent numeric NOT NULL DEFAULT 80 CHECK (warn_at_percent > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX category_budgets_uniq ON public.category_budgets (category_code, COALESCE(month, '1900-01-01'::date));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_budgets TO authenticated;
GRANT ALL ON public.category_budgets TO service_role;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage budgets" ON public.category_budgets FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER category_budgets_touch BEFORE UPDATE ON public.category_budgets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER category_budgets_audit AFTER INSERT OR UPDATE OR DELETE ON public.category_budgets FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

CREATE OR REPLACE FUNCTION public.category_budget_status(_month date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH m AS (SELECT date_trunc('month', _month)::date AS s),
  b AS (
    SELECT DISTINCT ON (cb.category_code) cb.*
    FROM category_budgets cb, m
    WHERE public.is_owner() AND (cb.month IS NULL OR date_trunc('month', cb.month)::date = m.s)
    ORDER BY cb.category_code, (cb.month IS NULL)
  ),
  x AS (
    SELECT b.id, b.category_code, b.month, b.amount, b.warn_at_percent,
      COALESCE((SELECT sum(COALESCE(e.base_amount, e.amount)) FROM expenses e, m
        WHERE e.category = b.category_code AND e.entry_date >= m.s AND e.entry_date < (m.s + interval '1 month')), 0) AS spent
    FROM b
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category', category_code, 'budget_id', id, 'every_month', month IS NULL,
    'budget', amount, 'warn_at_percent', warn_at_percent, 'spent', round(spent, 2),
    'remaining', round(amount - spent, 2),
    'percent', CASE WHEN amount > 0 THEN round(spent * 100 / amount, 1) END,
    'state', CASE WHEN spent > amount THEN 'over' WHEN amount > 0 AND spent * 100 / amount >= warn_at_percent THEN 'warn' ELSE 'ok' END
  ) ORDER BY category_code), '[]'::jsonb) FROM x;
$$;
GRANT EXECUTE ON FUNCTION public.category_budget_status(date) TO authenticated;