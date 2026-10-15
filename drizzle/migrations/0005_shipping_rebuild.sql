ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS sender_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS shipping_fx numeric(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shipping_base numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_paid_by_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customs_currency text NOT NULL DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS customs_fx numeric(14,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS customs_base numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customs_paid_by_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profit_split jsonb,
  ADD COLUMN IF NOT EXISTS cost_owed_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.shipments.total_paid_weight_kg IS 'DEPRECATED: allocation uses actual line weights';
UPDATE public.shipments SET shipping_base = total_shipping_cost, customs_base = customs_cost, customs_currency = currency;

ALTER TABLE public.shipment_items
  ADD COLUMN IF NOT EXISTS unit_weight_grams numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS allocated_shipping_line numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocated_customs_line numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ship_unit numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customs_unit numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_code text,
  ADD COLUMN IF NOT EXISTS first_serial text,
  ADD COLUMN IF NOT EXISTS last_serial text;
UPDATE public.shipment_items SET product_cost = unit_product_cost,
  unit_weight_grams = CASE WHEN quantity > 0 THEN ROUND(total_weight_kg * 1000 / quantity, 2) ELSE 0 END;
COMMENT ON COLUMN public.shipment_items.supplier_amount_owed IS 'DEPRECATED: May is a partner; shipping/customs are not deducted from what she is owed';
COMMENT ON COLUMN public.shipment_items.unit_product_cost IS 'DEPRECATED: replaced by product_cost (nullable = cost pending)';

ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profit_split jsonb,
  ADD COLUMN IF NOT EXISTS cost_owed_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;

ALTER TABLE public.partner_transactions
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS shipment_cost_kind text;

DROP TRIGGER IF EXISTS audit_shipment_items ON public.shipment_items;
CREATE TRIGGER audit_shipment_items AFTER INSERT OR UPDATE OR DELETE ON public.shipment_items FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
DROP TRIGGER IF EXISTS audit_inventory_batches ON public.inventory_batches;
CREATE TRIGGER audit_inventory_batches AFTER INSERT OR UPDATE OR DELETE ON public.inventory_batches FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

-- Weight-based allocation in base currency; rounding remainder on the last line.
CREATE OR REPLACE FUNCTION public.allocate_shipment(_shipment_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _s RECORD; _it RECORD; _w numeric; _n int; _i int := 0; _sa numeric := 0; _ca numeric := 0; _sl numeric; _cl numeric;
BEGIN
  SELECT * INTO _s FROM public.shipments WHERE id = _shipment_id;
  SELECT COALESCE(SUM(total_weight_kg),0), count(*) INTO _w, _n FROM public.shipment_items WHERE shipment_id = _shipment_id;
  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _shipment_id ORDER BY sort_order, created_at, id LOOP
    _i := _i + 1;
    IF _w <= 0 THEN _sl := 0; _cl := 0;
    ELSIF _i = _n THEN _sl := _s.shipping_base - _sa; _cl := _s.customs_base - _ca;
    ELSE _sl := ROUND(_s.shipping_base * _it.total_weight_kg / _w, 2); _cl := ROUND(_s.customs_base * _it.total_weight_kg / _w, 2);
    END IF;
    _sa := _sa + _sl; _ca := _ca + _cl;
    UPDATE public.shipment_items SET allocated_shipping_line = _sl, allocated_customs_line = _cl,
      ship_unit = CASE WHEN quantity > 0 THEN ROUND(_sl / quantity, 4) ELSE 0 END,
      customs_unit = CASE WHEN quantity > 0 THEN ROUND(_cl / quantity, 4) ELSE 0 END,
      allocated_shipping_per_unit = CASE WHEN quantity > 0 THEN ROUND(_sl / quantity, 2) ELSE 0 END,
      allocated_customs_per_unit = CASE WHEN quantity > 0 THEN ROUND(_cl / quantity, 2) ELSE 0 END,
      landed_unit_cost = CASE WHEN quantity > 0 THEN ROUND(COALESCE(product_cost,0) + (_sl + _cl) / quantity, 2) ELSE 0 END,
      supplier_amount_owed = 0
    WHERE id = _it.id;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.allocate_shipment(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_shipment(_id uuid, _s jsonb, _items jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_status public.shipment_status; it jsonb; i int := 0; v_qty int; v_g numeric;
  v_sa numeric; v_sfx numeric; v_ca numeric; v_cfx numeric; v_split jsonb; v_sum numeric; v_ref text; v_date date;
  v_sp uuid; v_cp uuid;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  v_ref := NULLIF(trim(_s->>'reference'),'');
  IF v_ref IS NULL THEN RAISE EXCEPTION 'REFERENCE_REQUIRED'; END IF;
  v_sa := COALESCE((_s->>'shipping_amount')::numeric,0); v_sfx := COALESCE((_s->>'shipping_fx')::numeric,1);
  v_ca := COALESCE((_s->>'customs_amount')::numeric,0); v_cfx := COALESCE((_s->>'customs_fx')::numeric,1);
  IF v_sa < 0 OR v_ca < 0 OR v_sfx <= 0 OR v_cfx <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  v_sp := NULLIF(_s->>'shipping_paid_by_partner_id','')::uuid; v_cp := NULLIF(_s->>'customs_paid_by_partner_id','')::uuid;
  IF (v_sp IS NOT NULL OR v_cp IS NOT NULL) AND NOT public.is_owner() THEN RAISE EXCEPTION 'OWNER_REQUIRED_PARTNER_PAYER'; END IF;
  v_split := CASE WHEN jsonb_typeof(_s->'profit_split') = 'array' AND jsonb_array_length(_s->'profit_split') > 0 THEN _s->'profit_split' ELSE NULL END;
  IF v_split IS NOT NULL THEN
    SELECT COALESCE(sum((x->>'percent')::numeric),0) INTO v_sum FROM jsonb_array_elements(v_split) x;
    IF abs(v_sum - 100) > 0.01 THEN RAISE EXCEPTION 'SPLIT_NOT_100'; END IF;
  END IF;
  IF _id IS NOT NULL THEN
    SELECT status INTO v_status FROM public.shipments WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found'; END IF;
    IF v_status = 'added_to_inventory' THEN RAISE EXCEPTION 'SHIPMENT_LOCKED'; END IF;
  END IF;
  IF COALESCE(_s->>'status','preparing') = 'added_to_inventory' THEN RAISE EXCEPTION 'USE_ADD_TO_INVENTORY'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.shipments(reference, created_by) VALUES (v_ref, auth.uid()) RETURNING id INTO v_id;
  ELSE v_id := _id; END IF;
  UPDATE public.shipments SET reference = v_ref, notes = NULLIF(_s->>'notes',''),
    status = COALESCE(_s->>'status','preparing')::public.shipment_status,
    status_dates = COALESCE(_s->'status_dates','{}'::jsonb),
    sender_partner_id = NULLIF(_s->>'sender_partner_id','')::uuid, sender_supplier_id = NULLIF(_s->>'sender_supplier_id','')::uuid,
    receipt_path = NULLIF(_s->>'receipt_path',''),
    total_shipping_cost = v_sa, currency = COALESCE(_s->>'shipping_currency','MYR'), shipping_fx = v_sfx, shipping_base = ROUND(v_sa * v_sfx, 2),
    customs_cost = v_ca, customs_currency = COALESCE(_s->>'customs_currency','MYR'), customs_fx = v_cfx, customs_base = ROUND(v_ca * v_cfx, 2),
    shipping_paid_by_partner_id = v_sp, customs_paid_by_partner_id = v_cp,
    profit_split = v_split, cost_owed_partner_id = NULLIF(_s->>'cost_owed_partner_id','')::uuid, updated_at = now()
  WHERE id = v_id;
  DELETE FROM public.shipment_items WHERE shipment_id = v_id;
  FOR it IN SELECT value FROM jsonb_array_elements(COALESCE(_items,'[]')) LOOP
    i := i + 1;
    v_qty := (it->>'quantity')::int; v_g := COALESCE((it->>'unit_weight_grams')::numeric,0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    IF v_g < 0 THEN RAISE EXCEPTION 'INVALID_WEIGHT'; END IF;
    INSERT INTO public.shipment_items(shipment_id, product_id, quantity, unit_weight_grams, total_weight_kg, product_cost, unit_product_cost, sort_order)
    VALUES (v_id, (it->>'product_id')::uuid, v_qty, v_g, ROUND(v_qty * v_g / 1000, 3),
      NULLIF(it->>'product_cost','')::numeric, COALESCE(NULLIF(it->>'product_cost','')::numeric,0), i);
  END LOOP;
  PERFORM public.allocate_shipment(v_id);
  -- Partner paid-on-behalf entries move together with the shipment.
  DELETE FROM public.partner_transactions WHERE shipment_id = v_id;
  v_date := COALESCE(NULLIF(_s->>'cost_date','')::date, CURRENT_DATE);
  IF v_sp IS NOT NULL AND v_sa > 0 THEN
    INSERT INTO public.partner_transactions(partner_id, txn_type, amount, currency, fx_rate_to_base, base_amount, txn_date, notes, receipt_path, shipment_id, shipment_cost_kind)
    VALUES (v_sp, 'paid_on_behalf', v_sa, COALESCE(_s->>'shipping_currency','MYR'), v_sfx, ROUND(v_sa*v_sfx,2), v_date, 'Shipment ' || v_ref || ' · shipping', NULLIF(_s->>'receipt_path',''), v_id, 'shipping');
  END IF;
  IF v_cp IS NOT NULL AND v_ca > 0 THEN
    INSERT INTO public.partner_transactions(partner_id, txn_type, amount, currency, fx_rate_to_base, base_amount, txn_date, notes, receipt_path, shipment_id, shipment_cost_kind)
    VALUES (v_cp, 'paid_on_behalf', v_ca, COALESCE(_s->>'customs_currency','MYR'), v_cfx, ROUND(v_ca*v_cfx,2), v_date, 'Shipment ' || v_ref || ' · customs', NULLIF(_s->>'receipt_path',''), v_id, 'customs');
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_shipment(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.shipment_status;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT status INTO v_status FROM public.shipments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF v_status = 'added_to_inventory' THEN RAISE EXCEPTION 'SHIPMENT_LOCKED'; END IF;
  DELETE FROM public.partner_transactions WHERE shipment_id = _id;
  DELETE FROM public.shipment_items WHERE shipment_id = _id;
  DELETE FROM public.margin_history WHERE shipment_id = _id;
  DELETE FROM public.expenses WHERE shipment_id = _id AND false;
  DELETE FROM public.shipments WHERE id = _id;
END $$;

DROP FUNCTION IF EXISTS public.receive_shipment(uuid);
CREATE FUNCTION public.receive_shipment(_shipment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _s RECORD; _it RECORD; _w numeric; _landed numeric(12,2); _old_qty int; _old_avg numeric(12,2); _new_avg numeric(12,2);
  _price numeric(12,2); _batch_id uuid; _codes jsonb; _out jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _s FROM public.shipments WHERE id = _shipment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF _s.status = 'added_to_inventory' THEN RAISE EXCEPTION 'ALREADY_ADDED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shipment_items WHERE shipment_id = _shipment_id) THEN RAISE EXCEPTION 'NO_LINES'; END IF;
  IF EXISTS (SELECT 1 FROM public.shipment_items WHERE shipment_id = _shipment_id AND product_cost IS NULL) THEN RAISE EXCEPTION 'COST_PENDING'; END IF;
  SELECT COALESCE(SUM(total_weight_kg),0) INTO _w FROM public.shipment_items WHERE shipment_id = _shipment_id;
  IF _w <= 0 THEN RAISE EXCEPTION 'NO_WEIGHT'; END IF;
  PERFORM public.allocate_shipment(_shipment_id);
  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _shipment_id ORDER BY sort_order, created_at, id LOOP
    _landed := _it.landed_unit_cost;
    SELECT stock_qty, avg_cost, sale_price INTO _old_qty, _old_avg, _price FROM public.products WHERE id = _it.product_id FOR UPDATE;
    _new_avg := ROUND(((GREATEST(_old_qty,0) * _old_avg) + (_it.quantity * _landed)) / NULLIF(GREATEST(_old_qty,0) + _it.quantity, 0), 2);
    INSERT INTO public.inventory_batches(product_id, quantity, unit_cost, shipping_cost, landed_unit_cost, received_at, notes, created_by, shipment_id, profit_split, cost_owed_partner_id)
    VALUES (_it.product_id, _it.quantity, _it.product_cost, _it.allocated_shipping_line + _it.allocated_customs_line, _landed, CURRENT_DATE,
      'Shipment ' || _s.reference, auth.uid(), _shipment_id, _s.profit_split, _s.cost_owed_partner_id)
    RETURNING id INTO _batch_id;
    UPDATE public.products SET stock_qty = _old_qty + _it.quantity, avg_cost = _new_avg, cost_price = _landed WHERE id = _it.product_id;
    INSERT INTO public.stock_movements(product_id, batch_id, change_qty, reason, note, user_id)
    VALUES (_it.product_id, _batch_id, _it.quantity, 'shipment_received', 'Shipment ' || _s.reference, auth.uid());
    _codes := public.generate_batch_codes(_it.product_id, _batch_id, _it.quantity);
    UPDATE public.shipment_items SET batch_id = _batch_id, batch_code = _codes->>'batch_code', first_serial = _codes->>'first_serial', last_serial = _codes->>'last_serial' WHERE id = _it.id;
    INSERT INTO public.margin_history(product_id, avg_cost, selling_price, margin_percent, source, shipment_id)
    VALUES (_it.product_id, _new_avg, COALESCE(_price,0), CASE WHEN COALESCE(_price,0) > 0 THEN ROUND(((_price - _new_avg) / _price) * 100, 2) ELSE 0 END, 'shipment', _shipment_id);
    _out := _out || jsonb_build_array(_codes || jsonb_build_object('product_id', _it.product_id));
  END LOOP;
  UPDATE public.shipments SET status = 'added_to_inventory', received_at = now(),
    status_dates = status_dates || jsonb_build_object('added_to_inventory', to_char(now(), 'YYYY-MM-DD')) WHERE id = _shipment_id;
  RETURN jsonb_build_object('lines', _out, 'split_missing', _s.profit_split IS NULL);
END $$;
GRANT EXECUTE ON FUNCTION public.save_shipment(uuid, jsonb, jsonb), public.delete_shipment(uuid), public.receive_shipment(uuid) TO authenticated;