ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_grams numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE public.product_code_counters (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  next_batch integer NOT NULL DEFAULT 1,
  next_serial integer NOT NULL DEFAULT 1
);
GRANT SELECT ON public.product_code_counters TO authenticated;
GRANT ALL ON public.product_code_counters TO service_role;
ALTER TABLE public.product_code_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops read counters" ON public.product_code_counters FOR SELECT TO authenticated USING (public.is_ops());

CREATE UNIQUE INDEX IF NOT EXISTS serial_numbers_serial_unique ON public.serial_numbers(serial);

CREATE OR REPLACE FUNCTION public.prevent_negative_stock() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stock_qty < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK: % (available %)', NEW.sku, OLD.stock_qty; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_no_negative_stock BEFORE UPDATE OF stock_qty ON public.products
FOR EACH ROW WHEN (NEW.stock_qty < 0 AND NEW.stock_qty < OLD.stock_qty) EXECUTE FUNCTION public.prevent_negative_stock();

CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id uuid, _change integer, _reason text, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF _change = 0 THEN RAISE EXCEPTION 'Change must not be zero'; END IF;
  UPDATE public.products SET stock_qty = stock_qty + _change WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  INSERT INTO public.stock_movements (product_id, change_qty, reason, note, user_id)
  VALUES (_product_id, _change, _reason, _note, auth.uid());
END; $function$;

-- generates batch code + serials, returns jsonb
CREATE OR REPLACE FUNCTION public.generate_batch_codes(_product_id uuid, _batch_id uuid, _quantity integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _sku text; _b integer; _s integer; _code text; i integer;
BEGIN
  SELECT sku INTO _sku FROM public.products WHERE id = _product_id;
  INSERT INTO public.product_code_counters(product_id) VALUES (_product_id) ON CONFLICT (product_id) DO NOTHING;
  UPDATE public.product_code_counters SET next_batch = next_batch + 1, next_serial = next_serial + _quantity
    WHERE product_id = _product_id RETURNING next_batch - 1, next_serial - _quantity INTO _b, _s;
  _code := _sku || '-B' || lpad(_b::text, 2, '0');
  UPDATE public.inventory_batches SET batch_code = _code WHERE id = _batch_id;
  FOR i IN 0.._quantity-1 LOOP
    INSERT INTO public.serial_numbers(product_id, batch_id, serial)
    VALUES (_product_id, _batch_id, _sku || '-' || lpad((_s+i)::text, 4, '0'));
  END LOOP;
  RETURN jsonb_build_object('batch_id', _batch_id, 'batch_code', _code,
    'first_serial', _sku || '-' || lpad(_s::text, 4, '0'),
    'last_serial', _sku || '-' || lpad((_s+_quantity-1)::text, 4, '0'), 'quantity', _quantity);
END; $function$;
REVOKE EXECUTE ON FUNCTION public.generate_batch_codes(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.receive_stock_auto(_product_id uuid, _quantity integer, _unit_cost numeric, _shipping_cost numeric, _supplier_id uuid DEFAULT NULL, _received_at date DEFAULT CURRENT_DATE, _notes text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _batch_id uuid; _landed numeric(12,2); _old_qty integer; _old_avg numeric(12,2);
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  _landed := ROUND(_unit_cost + (COALESCE(_shipping_cost,0) / _quantity), 2);
  SELECT stock_qty, avg_cost INTO _old_qty, _old_avg FROM public.products WHERE id = _product_id FOR UPDATE;
  IF _old_qty IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  INSERT INTO public.inventory_batches (product_id, supplier_id, quantity, unit_cost, shipping_cost, landed_unit_cost, received_at, notes, created_by)
  VALUES (_product_id, _supplier_id, _quantity, _unit_cost, COALESCE(_shipping_cost,0), _landed, COALESCE(_received_at, CURRENT_DATE), _notes, auth.uid())
  RETURNING id INTO _batch_id;
  UPDATE public.products SET stock_qty = _old_qty + _quantity,
    avg_cost = ROUND(((GREATEST(_old_qty,0) * _old_avg) + (_quantity * _landed)) / NULLIF(GREATEST(_old_qty,0) + _quantity, 0), 2),
    cost_price = _landed WHERE id = _product_id;
  INSERT INTO public.stock_movements (product_id, batch_id, change_qty, reason, note, user_id)
  VALUES (_product_id, _batch_id, _quantity, 'received', _notes, auth.uid());
  RETURN public.generate_batch_codes(_product_id, _batch_id, _quantity);
END; $function$;

CREATE OR REPLACE FUNCTION public.create_order(_order jsonb, _lines jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid; _l record; _stock integer; _avg numeric; _sku text;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF jsonb_array_length(COALESCE(_lines,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'NO_LINES'; END IF;
  INSERT INTO public.orders(order_number, order_date, platform, status, customer_name, shipping_cost, platform_fee, notes, created_by)
  VALUES (NULLIF(_order->>'order_number',''), (_order->>'order_date')::date, _order->>'platform', COALESCE(_order->>'status','pending'),
    NULLIF(_order->>'customer_name',''), COALESCE((_order->>'shipping_cost')::numeric,0), COALESCE((_order->>'platform_fee')::numeric,0),
    NULLIF(_order->>'notes',''), auth.uid())
  RETURNING id INTO _id;
  FOR _l IN SELECT (x->>'product_id')::uuid pid, SUM((x->>'quantity')::int) qty FROM jsonb_array_elements(_lines) x GROUP BY 1 LOOP
    IF _l.qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    SELECT stock_qty, sku INTO _stock, _sku FROM public.products WHERE id = _l.pid FOR UPDATE;
    IF _stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF _l.qty > _stock THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK: % (available %)', _sku, _stock; END IF;
  END LOOP;
  FOR _l IN SELECT (x->>'product_id')::uuid pid, (x->>'quantity')::int qty, (x->>'sale_price')::numeric price FROM jsonb_array_elements(_lines) x LOOP
    SELECT COALESCE(NULLIF(avg_cost,0), cost_price, 0) INTO _avg FROM public.products WHERE id = _l.pid;
    INSERT INTO public.order_items(order_id, product_id, quantity, sale_price, unit_cost) VALUES (_id, _l.pid, _l.qty, _l.price, _avg);
    UPDATE public.products SET stock_qty = stock_qty - _l.qty WHERE id = _l.pid;
    INSERT INTO public.stock_movements(product_id, change_qty, reason, note, user_id) VALUES (_l.pid, -_l.qty, 'sale', 'Order ' || COALESCE(_order->>'order_number', _id::text), auth.uid());
  END LOOP;
  RETURN _id;
END; $function$;

CREATE OR REPLACE FUNCTION public.receive_shipment(_shipment_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _s RECORD; _it RECORD; _total_weight NUMERIC(12,3); _ship_per_kg NUMERIC(14,6); _cust_per_kg NUMERIC(14,6);
  _alloc_ship_line NUMERIC(14,4); _alloc_cust_line NUMERIC(14,4); _alloc_ship_unit NUMERIC(12,2); _alloc_cust_unit NUMERIC(12,2);
  _landed NUMERIC(12,2); _old_qty INTEGER; _old_avg NUMERIC(12,2); _new_avg NUMERIC(12,2); _price NUMERIC(12,2); _batch_id UUID;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _s FROM public.shipments WHERE id = _shipment_id FOR UPDATE;
  IF _s IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF _s.status = 'added_to_inventory' THEN RAISE EXCEPTION 'Shipment already added to inventory'; END IF;
  SELECT COALESCE(SUM(total_weight_kg),0) INTO _total_weight FROM public.shipment_items WHERE shipment_id = _shipment_id;
  IF _total_weight <= 0 THEN RAISE EXCEPTION 'Shipment has no weight recorded'; END IF;
  _ship_per_kg := _s.total_shipping_cost / _total_weight;
  _cust_per_kg := COALESCE(_s.customs_cost,0) / _total_weight;
  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _shipment_id LOOP
    IF _it.quantity <= 0 THEN CONTINUE; END IF;
    _alloc_ship_line := _ship_per_kg * _it.total_weight_kg;
    _alloc_cust_line := _cust_per_kg * _it.total_weight_kg;
    _alloc_ship_unit := ROUND(_alloc_ship_line / _it.quantity, 2);
    _alloc_cust_unit := ROUND(_alloc_cust_line / _it.quantity, 2);
    _landed := ROUND(_it.unit_product_cost + _alloc_ship_unit + _alloc_cust_unit, 2);
    UPDATE public.shipment_items SET allocated_shipping_per_unit = _alloc_ship_unit, allocated_customs_per_unit = _alloc_cust_unit,
      landed_unit_cost = _landed, supplier_amount_owed = ROUND((_it.unit_product_cost * _it.quantity) - (_alloc_ship_line + _alloc_cust_line), 2)
      WHERE id = _it.id;
    SELECT stock_qty, avg_cost, sale_price INTO _old_qty, _old_avg, _price FROM public.products WHERE id = _it.product_id FOR UPDATE;
    _new_avg := ROUND(((GREATEST(_old_qty,0) * _old_avg) + (_it.quantity * _landed)) / NULLIF(GREATEST(_old_qty,0) + _it.quantity, 0), 2);
    INSERT INTO public.inventory_batches (product_id, supplier_id, quantity, unit_cost, shipping_cost, landed_unit_cost, received_at, notes, created_by)
    VALUES (_it.product_id, _it.supplier_id, _it.quantity, _it.unit_product_cost, ROUND(_alloc_ship_line + _alloc_cust_line, 2), _landed, CURRENT_DATE, 'Shipment ' || _s.reference, auth.uid())
    RETURNING id INTO _batch_id;
    UPDATE public.products SET stock_qty = _old_qty + _it.quantity, avg_cost = _new_avg, cost_price = _landed WHERE id = _it.product_id;
    INSERT INTO public.stock_movements (product_id, batch_id, change_qty, reason, note, user_id)
    VALUES (_it.product_id, _batch_id, _it.quantity, 'shipment_received', 'Shipment ' || _s.reference, auth.uid());
    PERFORM public.generate_batch_codes(_it.product_id, _batch_id, _it.quantity);
    INSERT INTO public.margin_history (product_id, avg_cost, selling_price, margin_percent, source, shipment_id)
    VALUES (_it.product_id, _new_avg, COALESCE(_price,0),
      CASE WHEN COALESCE(_price,0) > 0 THEN ROUND(((_price - _new_avg) / _price) * 100, 2) ELSE 0 END, 'shipment', _shipment_id);
  END LOOP;
  UPDATE public.shipments SET status = 'added_to_inventory', received_at = now(),
    status_dates = status_dates || jsonb_build_object('added_to_inventory', to_char(now(), 'YYYY-MM-DD')) WHERE id = _shipment_id;
END; $function$;

CREATE POLICY "product images public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product images ops insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_ops());
CREATE POLICY "product images ops update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.is_ops());
CREATE POLICY "product images ops delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.is_ops());