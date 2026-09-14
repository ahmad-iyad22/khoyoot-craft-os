
-- 1. Categories with stable prefixes -------------------------------------------------
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS prefix_code text;

DELETE FROM public.categories WHERE name IN ('Ceramics','Olive Wood','Food & Spices','Embroidery');
DELETE FROM public.sku_prefixes WHERE code IN ('OLV','CER','EMB','JEW')
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.prefix_code = sku_prefixes.code);

INSERT INTO public.sku_prefixes (code, label, label_ar, next_number) VALUES
  ('LEA','Leather goods','منتجات جلدية',1),
  ('BLO','Blouses / Thoub','بلوزات وثوب',1),
  ('BAG','Fabric bags','حقائب قماشية',1),
  ('MED','Medallions / Jewelry','ميداليات ومجوهرات',1),
  ('LIN','Embroidered linens','مفارش مطرزة',1)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, label_ar = EXCLUDED.label_ar;

INSERT INTO public.categories (name, name_ar, prefix_code) VALUES
  ('Leather goods','منتجات جلدية','LEA'),
  ('Blouses / Thoub','بلوزات وثوب','BLO'),
  ('Fabric bags','حقائب قماشية','BAG'),
  ('Medallions / Jewelry','ميداليات ومجوهرات','MED'),
  ('Embroidered linens','مفارش مطرزة','LIN')
ON CONFLICT DO NOTHING;

-- 2. Shipments: customs cost + supplier on lines --------------------------------------
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS customs_cost numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shipment_items
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocated_customs_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_amount_owed numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Agreed supplier prices per product ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  agreed_price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_prices TO authenticated;
GRANT ALL ON public.supplier_prices TO service_role;
ALTER TABLE public.supplier_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops manage supplier prices" ON public.supplier_prices FOR ALL TO authenticated
  USING (public.is_ops()) WITH CHECK (public.is_ops());
CREATE TRIGGER supplier_prices_touch BEFORE UPDATE ON public.supplier_prices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Supplier payments ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages supplier payments" ON public.supplier_payments FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER supplier_payments_touch BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Partners: expense share ----------------------------------------------------------
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS expense_share_percent numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 6. Editable expense categories ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  label_ar text,
  is_shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read expense categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner manages expense categories" ON public.expense_categories FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

INSERT INTO public.expense_categories (code, label, label_ar, is_shared) VALUES
  ('international_shipping','International shipping','الشحن الدولي',true),
  ('marketing','Marketing','التسويق',true),
  ('advertising','Advertising','الإعلانات',true),
  ('content_production','Content production','إنتاج المحتوى',true),
  ('ai_subscriptions','AI subscriptions','اشتراكات الذكاء الاصطناعي',true),
  ('canva','Canva','كانفا',true),
  ('website_hosting','Website / hosting','الموقع والاستضافة',true),
  ('cloud_services','Cloud services','الخدمات السحابية',true),
  ('software_subscriptions','Software subscriptions','اشتراكات البرامج',true),
  ('platform_fees','Platform fees','رسوم المنصات',false),
  ('supplies','Supplies','مستلزمات',false),
  ('other','Other','أخرى',true)
ON CONFLICT (code) DO NOTHING;

-- 7. Shared expense splitting ----------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_by_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_mode text NOT NULL DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  share_amount numeric(12,2) NOT NULL DEFAULT 0,
  share_percent numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, partner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_splits TO authenticated;
GRANT ALL ON public.expense_splits TO service_role;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages expense splits" ON public.expense_splits FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- 8. Live shipment line cost allocation view ------------------------------------------
CREATE OR REPLACE VIEW public.shipment_line_costs
WITH (security_invoker = true) AS
WITH totals AS (
  SELECT si.shipment_id, SUM(si.total_weight_kg) AS total_weight
  FROM public.shipment_items si GROUP BY si.shipment_id
)
SELECT
  si.id,
  si.shipment_id,
  si.product_id,
  si.supplier_id,
  si.quantity,
  si.total_weight_kg,
  si.unit_product_cost AS supplier_price_per_unit,
  t.total_weight,
  CASE WHEN t.total_weight > 0 THEN s.total_shipping_cost / t.total_weight ELSE 0 END AS shipping_cost_per_kg,
  CASE WHEN t.total_weight > 0 THEN s.customs_cost / t.total_weight ELSE 0 END AS customs_cost_per_kg,
  CASE WHEN t.total_weight > 0 THEN (s.total_shipping_cost / t.total_weight) * si.total_weight_kg ELSE 0 END AS allocated_shipping_line,
  CASE WHEN t.total_weight > 0 THEN (s.customs_cost / t.total_weight) * si.total_weight_kg ELSE 0 END AS allocated_customs_line,
  CASE WHEN t.total_weight > 0 AND si.quantity > 0
       THEN ((s.total_shipping_cost / t.total_weight) * si.total_weight_kg) / si.quantity ELSE 0 END AS allocated_shipping_unit,
  CASE WHEN t.total_weight > 0 AND si.quantity > 0
       THEN ((s.customs_cost / t.total_weight) * si.total_weight_kg) / si.quantity ELSE 0 END AS allocated_customs_unit,
  si.unit_product_cost
    + CASE WHEN t.total_weight > 0 AND si.quantity > 0
        THEN (((s.total_shipping_cost + s.customs_cost) / t.total_weight) * si.total_weight_kg) / si.quantity ELSE 0 END
    AS landed_cost_per_unit,
  (si.unit_product_cost * si.quantity)
    - CASE WHEN t.total_weight > 0
        THEN ((s.total_shipping_cost + s.customs_cost) / t.total_weight) * si.total_weight_kg ELSE 0 END
    AS supplier_amount_owed_live
FROM public.shipment_items si
JOIN public.shipments s ON s.id = si.shipment_id
LEFT JOIN totals t ON t.shipment_id = si.shipment_id;

GRANT SELECT ON public.shipment_line_costs TO authenticated;

-- 9. Supplier owed ledger --------------------------------------------------------------
CREATE OR REPLACE VIEW public.supplier_balances
WITH (security_invoker = true) AS
SELECT
  sup.id AS supplier_id,
  sup.name,
  COALESCE(owed.total_owed, 0) AS total_owed,
  COALESCE(pay.total_paid, 0) AS total_paid,
  COALESCE(owed.total_owed, 0) - COALESCE(pay.total_paid, 0) AS balance
FROM public.suppliers sup
LEFT JOIN (
  SELECT c.supplier_id, SUM(c.supplier_amount_owed_live) AS total_owed
  FROM public.shipment_line_costs c WHERE c.supplier_id IS NOT NULL GROUP BY c.supplier_id
) owed ON owed.supplier_id = sup.id
LEFT JOIN (
  SELECT sp.supplier_id, SUM(sp.amount) AS total_paid
  FROM public.supplier_payments sp GROUP BY sp.supplier_id
) pay ON pay.supplier_id = sup.id;

GRANT SELECT ON public.supplier_balances TO authenticated;

-- 10. receive_shipment: include customs allocation and supplier owed -------------------
CREATE OR REPLACE FUNCTION public.receive_shipment(_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _s RECORD; _it RECORD;
  _total_weight NUMERIC(12,3);
  _ship_per_kg NUMERIC(14,6);
  _cust_per_kg NUMERIC(14,6);
  _alloc_ship_line NUMERIC(14,4);
  _alloc_cust_line NUMERIC(14,4);
  _alloc_ship_unit NUMERIC(12,2);
  _alloc_cust_unit NUMERIC(12,2);
  _landed NUMERIC(12,2);
  _old_qty INTEGER; _old_avg NUMERIC(12,2); _new_avg NUMERIC(12,2);
  _price NUMERIC(12,2);
  _batch_id UUID;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _s FROM public.shipments WHERE id = _shipment_id FOR UPDATE;
  IF _s IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF _s.status = 'added_to_inventory' THEN RAISE EXCEPTION 'Shipment already added to inventory'; END IF;

  SELECT COALESCE(SUM(total_weight_kg),0) INTO _total_weight FROM public.shipment_items WHERE shipment_id = _shipment_id;
  IF _total_weight <= 0 THEN RAISE EXCEPTION 'Shipment has no weight recorded'; END IF;

  -- the FULL actual shipping and customs cost paid is always the allocation base
  _ship_per_kg := _s.total_shipping_cost / _total_weight;
  _cust_per_kg := COALESCE(_s.customs_cost,0) / _total_weight;

  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _shipment_id LOOP
    IF _it.quantity <= 0 THEN CONTINUE; END IF;
    _alloc_ship_line := _ship_per_kg * _it.total_weight_kg;
    _alloc_cust_line := _cust_per_kg * _it.total_weight_kg;
    _alloc_ship_unit := ROUND(_alloc_ship_line / _it.quantity, 2);
    _alloc_cust_unit := ROUND(_alloc_cust_line / _it.quantity, 2);
    _landed := ROUND(_it.unit_product_cost + _alloc_ship_unit + _alloc_cust_unit, 2);

    UPDATE public.shipment_items
      SET allocated_shipping_per_unit = _alloc_ship_unit,
          allocated_customs_per_unit = _alloc_cust_unit,
          landed_unit_cost = _landed,
          supplier_amount_owed = ROUND((_it.unit_product_cost * _it.quantity) - (_alloc_ship_line + _alloc_cust_line), 2)
      WHERE id = _it.id;

    SELECT stock_qty, avg_cost, sale_price INTO _old_qty, _old_avg, _price
      FROM public.products WHERE id = _it.product_id FOR UPDATE;

    _new_avg := ROUND(((_old_qty * _old_avg) + (_it.quantity * _landed)) / NULLIF(_old_qty + _it.quantity, 0), 2);

    INSERT INTO public.inventory_batches (product_id, supplier_id, batch_code, quantity, unit_cost, shipping_cost, landed_unit_cost, received_at, notes, created_by)
    VALUES (_it.product_id, _it.supplier_id, _s.reference, _it.quantity, _it.unit_product_cost,
            ROUND(_alloc_ship_line + _alloc_cust_line, 2), _landed, CURRENT_DATE, 'Shipment ' || _s.reference, auth.uid())
    RETURNING id INTO _batch_id;

    UPDATE public.products SET stock_qty = _old_qty + _it.quantity, avg_cost = _new_avg, cost_price = _landed
      WHERE id = _it.product_id;

    INSERT INTO public.stock_movements (product_id, batch_id, change_qty, reason, note, user_id)
    VALUES (_it.product_id, _batch_id, _it.quantity, 'shipment_received', 'Shipment ' || _s.reference, auth.uid());

    INSERT INTO public.margin_history (product_id, avg_cost, selling_price, margin_percent, source, shipment_id)
    VALUES (_it.product_id, _new_avg, COALESCE(_price,0),
            CASE WHEN COALESCE(_price,0) > 0 THEN ROUND(((_price - _new_avg) / _price) * 100, 2) ELSE 0 END,
            'shipment', _shipment_id);
  END LOOP;

  UPDATE public.shipments
    SET status = 'added_to_inventory',
        received_at = now(),
        status_dates = status_dates || jsonb_build_object('added_to_inventory', to_char(now(), 'YYYY-MM-DD'))
    WHERE id = _shipment_id;
END; $function$;
