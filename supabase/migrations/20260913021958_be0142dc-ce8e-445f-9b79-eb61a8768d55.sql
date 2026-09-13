
-- 0. profile language
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

-- 1. SKU prefixes
CREATE TABLE IF NOT EXISTS public.sku_prefixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_ar TEXT,
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sku_prefixes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sku_prefixes TO authenticated;
GRANT ALL ON public.sku_prefixes TO service_role;
ALTER TABLE public.sku_prefixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefixes read" ON public.sku_prefixes FOR SELECT TO authenticated USING (true);
CREATE POLICY "prefixes write" ON public.sku_prefixes FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

INSERT INTO public.sku_prefixes (code, label) VALUES
  ('OLV','Olive wood'), ('EMB','Embroidery'), ('CER','Ceramics'),
  ('LEA','Leather'), ('BAG','Bags'), ('JEW','Jewellery')
ON CONFLICT (code) DO NOTHING;

-- 2. product status + extra fields
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('idea','in_development','preparing','ready','future_product','active','out_of_stock','discontinued');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status public.product_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expected_launch_date DATE,
  ADD COLUMN IF NOT EXISTS prefix_code TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS how_made TEXT,
  ADD COLUMN IF NOT EXISTS materials TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_margin NUMERIC(5,2) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS margin_alert_threshold NUMERIC(5,2) NOT NULL DEFAULT 20;

-- 3. next SKU generator
CREATE OR REPLACE FUNCTION public.next_sku_preview(_code TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code || '-' || lpad(p.next_number::text, 3, '0')
  FROM public.sku_prefixes p WHERE p.code = _code AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.claim_next_sku(_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n INTEGER; _sku TEXT;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.sku_prefixes SET next_number = next_number + 1
  WHERE code = _code RETURNING next_number - 1 INTO _n;
  IF _n IS NULL THEN RAISE EXCEPTION 'Unknown prefix %', _code; END IF;
  _sku := _code || '-' || lpad(_n::text, 3, '0');
  WHILE EXISTS (SELECT 1 FROM public.products WHERE sku = _sku) LOOP
    UPDATE public.sku_prefixes SET next_number = next_number + 1 WHERE code = _code RETURNING next_number - 1 INTO _n;
    _sku := _code || '-' || lpad(_n::text, 3, '0');
  END LOOP;
  RETURN _sku;
END; $$;

-- 4. shipments
DO $$ BEGIN
  CREATE TYPE public.shipment_status AS ENUM ('preparing','sent_from_palestine','in_transit','customs','arrived_in_malaysia','added_to_inventory');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'NIS',
  total_shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid_weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  status public.shipment_status NOT NULL DEFAULT 'preparing',
  status_dates JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments ops" ON public.shipments FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());
CREATE TRIGGER shipments_touch BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit_product_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  allocated_shipping_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  landed_unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_items TO authenticated;
GRANT ALL ON public.shipment_items TO service_role;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipment items ops" ON public.shipment_items FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

-- 5. margin history
CREATE TABLE IF NOT EXISTS public.margin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  avg_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  margin_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'shipment',
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT ON public.margin_history TO authenticated;
GRANT ALL ON public.margin_history TO service_role;
ALTER TABLE public.margin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "margin history ops" ON public.margin_history FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

-- 6. platform analytics
CREATE TABLE IF NOT EXISTS public.platform_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  views INTEGER NOT NULL DEFAULT 0,
  product_views INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  ad_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_analytics TO authenticated;
GRANT ALL ON public.platform_analytics TO service_role;
ALTER TABLE public.platform_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform analytics read" ON public.platform_analytics FOR SELECT TO authenticated USING (public.is_marketing() OR public.is_ops());
CREATE POLICY "platform analytics write" ON public.platform_analytics FOR ALL TO authenticated USING (public.is_marketing() OR public.is_ops()) WITH CHECK (public.is_marketing() OR public.is_ops());
CREATE TRIGGER platform_analytics_touch BEFORE UPDATE ON public.platform_analytics FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. content calendar performance
ALTER TABLE public.content_calendar
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributed_orders INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 8. shipment receiving with exact cost allocation
CREATE OR REPLACE FUNCTION public.receive_shipment(_shipment_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s RECORD; _it RECORD;
  _total_weight NUMERIC(12,3);
  _cost_per_kg NUMERIC(14,6);
  _alloc_line NUMERIC(14,4);
  _alloc_unit NUMERIC(12,2);
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

  -- full actual shipping cost paid is always the allocation base
  _cost_per_kg := _s.total_shipping_cost / _total_weight;

  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _shipment_id LOOP
    IF _it.quantity <= 0 THEN CONTINUE; END IF;
    _alloc_line := _cost_per_kg * _it.total_weight_kg;
    _alloc_unit := ROUND(_alloc_line / _it.quantity, 2);
    _landed := ROUND(_it.unit_product_cost + _alloc_unit, 2);

    UPDATE public.shipment_items
      SET allocated_shipping_per_unit = _alloc_unit, landed_unit_cost = _landed
      WHERE id = _it.id;

    SELECT stock_qty, avg_cost, sale_price INTO _old_qty, _old_avg, _price
      FROM public.products WHERE id = _it.product_id FOR UPDATE;

    _new_avg := ROUND(((_old_qty * _old_avg) + (_it.quantity * _landed)) / NULLIF(_old_qty + _it.quantity, 0), 2);

    INSERT INTO public.inventory_batches (product_id, batch_code, quantity, unit_cost, shipping_cost, landed_unit_cost, received_at, notes, created_by)
    VALUES (_it.product_id, _s.reference, _it.quantity, _it.unit_product_cost, ROUND(_alloc_line,2), _landed, CURRENT_DATE, 'Shipment ' || _s.reference, auth.uid())
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
END; $$;

REVOKE EXECUTE ON FUNCTION public.next_sku_preview(TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_next_sku(TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.receive_shipment(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.next_sku_preview(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_sku(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_shipment(UUID) TO authenticated;
