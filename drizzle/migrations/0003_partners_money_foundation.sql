CREATE OR REPLACE FUNCTION public.has_any_role() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.get_products_basic()
 RETURNS TABLE(id uuid, sku text, name text, name_ar text, category_id uuid, sale_price numeric, stock_qty integer, archived boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT p.id, p.sku, p.name, p.name_ar, p.category_id, p.sale_price, p.stock_qty, p.archived
  FROM public.products p WHERE public.has_any_role()
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_performance()
 RETURNS TABLE(product_id uuid, name text, sku text, platform text, month date, units_sold bigint, revenue numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT p.id, p.name, p.sku, o.platform, date_trunc('month', o.order_date)::date, SUM(oi.quantity)::bigint, SUM(oi.quantity * oi.sale_price)
  FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id JOIN public.products p ON p.id = oi.product_id
  WHERE o.status <> 'cancelled' AND public.has_any_role()
  GROUP BY p.id, p.name, p.sku, o.platform, date_trunc('month', o.order_date)
$function$;

CREATE OR REPLACE FUNCTION public.next_sku_preview(_code text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT p.code || '-' || lpad(p.next_number::text, 3, '0') FROM public.sku_prefixes p WHERE p.code = _code AND public.has_any_role()
$function$;

-- storage: tighten product images read
DROP POLICY IF EXISTS "product images public read" ON storage.objects;
CREATE POLICY "product images signed-in read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND public.has_any_role());
-- receipts (owner only)
CREATE POLICY "receipts owner read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts' AND public.is_owner());
CREATE POLICY "receipts owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts' AND public.is_owner());
CREATE POLICY "receipts owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'receipts' AND public.is_owner());
CREATE POLICY "receipts owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'receipts' AND public.is_owner());

-- currency settings
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  base_currency text NOT NULL DEFAULT 'MYR',
  currencies text[] NOT NULL DEFAULT ARRAY['MYR','ILS','USD'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (public.has_any_role());
CREATE POLICY "settings owner write" ON public.app_settings FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
INSERT INTO public.app_settings(id) VALUES (true) ON CONFLICT DO NOTHING;

-- platform fees structure
ALTER TABLE public.platform_fees
  ADD COLUMN IF NOT EXISTS commission_percent numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_fee_percent numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sst_percent numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiver_until date,
  ADD COLUMN IF NOT EXISTS note text;
UPDATE public.platform_fees SET commission_percent = fee_percent WHERE commission_percent = 0;
COMMENT ON COLUMN public.platform_fees.fee_percent IS 'DEPRECATED: replaced by commission_percent';

-- partner transactions money fields
ALTER TABLE public.partner_transactions
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.partner_transactions SET base_amount = amount WHERE base_amount IS NULL;
COMMENT ON COLUMN public.partners.share_percent IS 'DEPRECATED: profit shares are set per shipment/period';
COMMENT ON COLUMN public.partners.expense_share_percent IS 'DEPRECATED: splits are stored per expense';

-- expenses money fields
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS paid_by_business boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL;
UPDATE public.expenses SET base_amount = amount WHERE base_amount IS NULL;
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount numeric(14,2);
UPDATE public.income SET base_amount = amount WHERE base_amount IS NULL;

-- save shared expense atomically
CREATE OR REPLACE FUNCTION public.save_shared_expense(_id uuid, _e jsonb, _splits jsonb) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_amount numeric; v_fx numeric; v_base numeric; v_pct numeric; v_sum numeric; s jsonb; n int; i int := 0; v_alloc numeric := 0; v_share numeric;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Owner access required'; END IF;
  v_amount := (_e->>'amount')::numeric; v_fx := COALESCE((_e->>'fx_rate_to_base')::numeric, 1);
  IF v_amount <= 0 OR v_fx <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  v_base := ROUND(v_amount * v_fx, 2);
  SELECT COALESCE(sum((x->>'percent')::numeric),0), count(*) INTO v_pct, n FROM jsonb_array_elements(COALESCE(_splits,'[]')) x;
  IF n = 0 OR abs(v_pct - 100) > 0.01 THEN RAISE EXCEPTION 'SPLIT_NOT_100'; END IF;
  IF (_e->>'paid_by_partner_id') IS NULL AND NOT COALESCE((_e->>'paid_by_business')::boolean,false) THEN RAISE EXCEPTION 'PAYER_REQUIRED'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.expenses(entry_date, category, amount, currency, fx_rate_to_base, base_amount, description, paid_by_partner_id, paid_by_business, is_shared, split_mode, campaign_id, shipment_id, receipt_path, created_by)
    VALUES ((_e->>'entry_date')::date, _e->>'category', v_amount, COALESCE(_e->>'currency','MYR'), v_fx, v_base, NULLIF(_e->>'description',''),
      NULLIF(_e->>'paid_by_partner_id','')::uuid, COALESCE((_e->>'paid_by_business')::boolean,false), true, COALESCE(_e->>'split_mode','equal'),
      NULLIF(_e->>'campaign_id','')::uuid, NULLIF(_e->>'shipment_id','')::uuid, NULLIF(_e->>'receipt_path',''), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.expenses SET entry_date=(_e->>'entry_date')::date, category=_e->>'category', amount=v_amount, currency=COALESCE(_e->>'currency','MYR'),
      fx_rate_to_base=v_fx, base_amount=v_base, description=NULLIF(_e->>'description',''), paid_by_partner_id=NULLIF(_e->>'paid_by_partner_id','')::uuid,
      paid_by_business=COALESCE((_e->>'paid_by_business')::boolean,false), is_shared=true, split_mode=COALESCE(_e->>'split_mode','equal'),
      campaign_id=NULLIF(_e->>'campaign_id','')::uuid, shipment_id=NULLIF(_e->>'shipment_id','')::uuid, receipt_path=NULLIF(_e->>'receipt_path',''), updated_at=now()
    WHERE id=_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Expense not found'; END IF;
    DELETE FROM public.expense_splits WHERE expense_id = v_id;
  END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(_splits) LOOP
    i := i + 1;
    v_share := CASE WHEN i = n THEN v_base - v_alloc ELSE ROUND(v_base * (s->>'percent')::numeric / 100, 2) END;
    v_alloc := v_alloc + v_share;
    INSERT INTO public.expense_splits(expense_id, partner_id, share_percent, share_amount)
    VALUES (v_id, (s->>'partner_id')::uuid, (s->>'percent')::numeric, v_share);
  END LOOP;
  RETURN v_id;
END $$;

-- generic audit for every create/update/delete
CREATE OR REPLACE FUNCTION public.audit_sensitive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _summary text; _rid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    BEGIN _rid := OLD.id; EXCEPTION WHEN others THEN _rid := NULL; END;
    INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, old_data)
    VALUES (auth.uid(), TG_TABLE_NAME, 'delete', _rid, 'Deleted ' || TG_TABLE_NAME, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  BEGIN _rid := NEW.id; EXCEPTION WHEN others THEN _rid := NULL; END;
  IF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) - 'updated_at' = to_jsonb(OLD) - 'updated_at' THEN RETURN NEW; END IF;
    _summary := 'Updated ' || TG_TABLE_NAME;
    IF TG_TABLE_NAME = 'products' AND NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
      INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, old_data, new_data)
      VALUES (auth.uid(), 'products','price_change', NEW.id, NEW.name || ': ' || OLD.sale_price || ' → ' || NEW.sale_price,
              jsonb_build_object('sale_price', OLD.sale_price), jsonb_build_object('sale_price', NEW.sale_price));
      RETURN NEW;
    END IF;
    INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, old_data, new_data)
    VALUES (auth.uid(), TG_TABLE_NAME, 'update', _rid, _summary, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, new_data)
  VALUES (auth.uid(), TG_TABLE_NAME, CASE WHEN TG_TABLE_NAME='partner_transactions' AND NEW.txn_type='withdrawal' THEN 'withdrawal' ELSE 'create' END,
          _rid, 'Created ' || TG_TABLE_NAME, to_jsonb(NEW));
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS audit_partners ON public.partners;
DROP TRIGGER IF EXISTS audit_partner_txn ON public.partner_transactions;
DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
CREATE TRIGGER audit_partners AFTER INSERT OR UPDATE OR DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_partner_txn AFTER INSERT OR UPDATE OR DELETE ON public.partner_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_expense_splits AFTER INSERT OR UPDATE OR DELETE ON public.expense_splits FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_expense_categories AFTER INSERT OR UPDATE OR DELETE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_platform_fees AFTER INSERT OR UPDATE OR DELETE ON public.platform_fees FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_income AFTER INSERT OR UPDATE OR DELETE ON public.income FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_app_settings AFTER INSERT OR UPDATE OR DELETE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();