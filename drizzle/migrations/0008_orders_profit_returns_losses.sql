
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packaging_cost_per_unit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS counting_statuses text[] NOT NULL DEFAULT '{delivered,completed}';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_auto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS split_override jsonb;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS packaging_unit_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_item_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_landed_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS remaining_qty integer;
UPDATE public.inventory_batches b SET remaining_qty = GREATEST(0, LEAST(b.quantity, GREATEST(p.stock_qty,0) - COALESCE((
  SELECT SUM(b2.quantity) FROM public.inventory_batches b2 WHERE b2.product_id = b.product_id
    AND (b2.received_at, b2.created_at, b2.id) > (b.received_at, b.created_at, b.id)), 0)))
FROM public.products p WHERE p.id = b.product_id;

CREATE OR REPLACE FUNCTION public.batch_default_remaining() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.remaining_qty := COALESCE(NEW.remaining_qty, NEW.quantity); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS batch_default_remaining ON public.inventory_batches;
CREATE TRIGGER batch_default_remaining BEFORE INSERT ON public.inventory_batches FOR EACH ROW EXECUTE FUNCTION public.batch_default_remaining();

ALTER TABLE public.serial_numbers ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL;

CREATE TABLE public.order_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  batch_code text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_item_cost numeric NOT NULL DEFAULT 0,
  unit_landed_cost numeric NOT NULL DEFAULT 0,
  profit_split jsonb,
  cost_owed_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  serials text[] NOT NULL DEFAULT '{}',
  returned_qty integer NOT NULL DEFAULT 0,
  returned_serials text[] NOT NULL DEFAULT '{}',
  refund_amount numeric NOT NULL DEFAULT 0,
  fee_refunded numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_allocations TO authenticated;
GRANT ALL ON public.order_allocations TO service_role;
ALTER TABLE public.order_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allocations ops read" ON public.order_allocations FOR SELECT TO authenticated USING (public.is_ops());

CREATE TABLE public.order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity integer NOT NULL CHECK (quantity > 0),
  action text NOT NULL CHECK (action IN ('restock','loss')),
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_platform_fee boolean NOT NULL DEFAULT false,
  platform_fee_refunded numeric NOT NULL DEFAULT 0,
  serials text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_returns TO authenticated;
GRANT ALL ON public.order_returns TO service_role;
ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns ops read" ON public.order_returns FOR SELECT TO authenticated USING (public.is_ops());

CREATE TABLE public.stock_losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loss_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  batch_code text,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL CHECK (reason IN ('damaged','lost','sample','gift','return_loss')),
  is_marketing boolean NOT NULL DEFAULT false,
  unit_item_cost numeric NOT NULL DEFAULT 0,
  unit_landed_cost numeric NOT NULL DEFAULT 0,
  loss_amount numeric NOT NULL DEFAULT 0,
  profit_split jsonb,
  cost_owed_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  return_id uuid REFERENCES public.order_returns(id) ON DELETE SET NULL,
  serials text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_losses TO authenticated;
GRANT ALL ON public.stock_losses TO service_role;
ALTER TABLE public.stock_losses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "losses ops read" ON public.stock_losses FOR SELECT TO authenticated USING (public.is_ops());

CREATE TRIGGER audit_order_items AFTER INSERT OR UPDATE OR DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_order_returns AFTER INSERT OR UPDATE OR DELETE ON public.order_returns FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_stock_losses AFTER INSERT OR UPDATE OR DELETE ON public.stock_losses FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

CREATE OR REPLACE FUNCTION public.split_valid(_s jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s IS NOT NULL AND jsonb_typeof(_s) = 'array' AND jsonb_array_length(_s) > 0
    AND (SELECT ROUND(SUM((x->>'percent')::numeric), 4) FROM jsonb_array_elements(_s) x) = 100
$$;

CREATE OR REPLACE FUNCTION public.compute_platform_fee(_platform text, _revenue numeric, _date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _f record; _waived boolean; _comm numeric; _base numeric; _amt numeric;
BEGIN
  IF NOT public.has_any_role() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _f FROM public.platform_fees WHERE platform = _platform;
  IF NOT FOUND OR COALESCE(_revenue,0) <= 0 THEN RETURN jsonb_build_object('amount', 0, 'snapshot', NULL); END IF;
  _waived := _f.waiver_until IS NOT NULL AND COALESCE(_date, CURRENT_DATE) <= _f.waiver_until;
  _comm := CASE WHEN _waived THEN 0 ELSE _f.commission_percent END;
  _base := _revenue * (_comm + _f.transaction_fee_percent) / 100 + _f.fixed_fee;
  _amt := ROUND(_base * (1 + _f.sst_percent / 100), 2);
  RETURN jsonb_build_object('amount', _amt, 'snapshot', jsonb_build_object(
    'platform', _f.platform, 'commission_percent', _f.commission_percent, 'transaction_fee_percent', _f.transaction_fee_percent,
    'fixed_fee', _f.fixed_fee, 'sst_percent', _f.sst_percent, 'waiver_until', _f.waiver_until, 'waived', _waived, 'revenue', _revenue));
END $$;

CREATE OR REPLACE FUNCTION public.preview_allocation(_product_id uuid, _qty integer, _serials text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _need int := _qty; _b record; _take int; _ser text[]; _out jsonb := '[]'::jsonb; _avg numeric;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF COALESCE(_qty,0) <= 0 THEN RETURN _out; END IF;
  IF _serials IS NOT NULL AND cardinality(_serials) > 0 THEN
    FOR _b IN SELECT ib.id, ib.batch_code, ib.unit_cost, ib.landed_unit_cost, ib.profit_split, array_agg(sn.serial ORDER BY sn.serial) sers
      FROM public.serial_numbers sn JOIN public.inventory_batches ib ON ib.id = sn.batch_id
      WHERE sn.product_id = _product_id AND sn.serial = ANY(_serials) AND sn.status = 'in_stock'
      GROUP BY ib.id ORDER BY ib.received_at, ib.created_at LOOP
      _out := _out || jsonb_build_array(jsonb_build_object('batch_id', _b.id, 'batch_code', _b.batch_code, 'quantity', cardinality(_b.sers),
        'serials', to_jsonb(_b.sers), 'unit_item_cost', _b.unit_cost, 'unit_landed_cost', _b.landed_unit_cost, 'profit_split', _b.profit_split));
      _need := _need - cardinality(_b.sers);
    END LOOP;
  ELSE
    FOR _b IN SELECT * FROM public.inventory_batches WHERE product_id = _product_id AND remaining_qty > 0 ORDER BY received_at, created_at, id LOOP
      EXIT WHEN _need <= 0;
      _take := LEAST(_need, _b.remaining_qty);
      SELECT array_agg(serial ORDER BY serial) INTO _ser FROM (SELECT serial FROM public.serial_numbers WHERE batch_id = _b.id AND status = 'in_stock' ORDER BY serial LIMIT _take) s;
      _out := _out || jsonb_build_array(jsonb_build_object('batch_id', _b.id, 'batch_code', _b.batch_code, 'quantity', _take,
        'serials', to_jsonb(COALESCE(_ser, '{}')), 'unit_item_cost', _b.unit_cost, 'unit_landed_cost', _b.landed_unit_cost, 'profit_split', _b.profit_split));
      _need := _need - _take;
    END LOOP;
  END IF;
  IF _need > 0 THEN
    SELECT COALESCE(NULLIF(avg_cost,0), cost_price, 0) INTO _avg FROM public.products WHERE id = _product_id;
    _out := _out || jsonb_build_array(jsonb_build_object('batch_id', NULL, 'batch_code', NULL, 'quantity', _need, 'serials', '[]'::jsonb,
      'unit_item_cost', _avg, 'unit_landed_cost', _avg, 'profit_split', NULL));
  END IF;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public._alloc_item(_order_id uuid, _item_id uuid, _pid uuid, _qty integer, _serials text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _need int := _qty; _b record; _take int; _ser text[]; _stock int; _sku text; _avg numeric; _cnt int; _ref text;
BEGIN
  SELECT stock_qty, sku, COALESCE(NULLIF(avg_cost,0), cost_price, 0) INTO _stock, _sku, _avg FROM public.products WHERE id = _pid FOR UPDATE;
  IF _stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF _qty > _stock THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK: % (available %)', _sku, _stock; END IF;
  SELECT COALESCE(order_number, id::text) INTO _ref FROM public.orders WHERE id = _order_id;
  IF _serials IS NOT NULL AND cardinality(_serials) > 0 THEN
    IF cardinality(_serials) <> _qty THEN RAISE EXCEPTION 'SERIAL_COUNT_MISMATCH'; END IF;
    SELECT count(*) INTO _cnt FROM public.serial_numbers WHERE product_id = _pid AND serial = ANY(_serials) AND status = 'in_stock' AND batch_id IS NOT NULL;
    IF _cnt <> _qty THEN RAISE EXCEPTION 'SERIAL_NOT_AVAILABLE'; END IF;
    FOR _b IN SELECT ib.id, ib.batch_code, ib.unit_cost, ib.landed_unit_cost, ib.profit_split, ib.cost_owed_partner_id, ib.remaining_qty,
        array_agg(sn.serial ORDER BY sn.serial) sers
      FROM public.serial_numbers sn JOIN public.inventory_batches ib ON ib.id = sn.batch_id
      WHERE sn.product_id = _pid AND sn.serial = ANY(_serials) GROUP BY ib.id ORDER BY ib.received_at, ib.created_at LOOP
      _take := cardinality(_b.sers);
      IF _b.remaining_qty < _take THEN RAISE EXCEPTION 'SERIAL_NOT_AVAILABLE'; END IF;
      INSERT INTO public.order_allocations(order_id, order_item_id, product_id, batch_id, batch_code, quantity, unit_item_cost, unit_landed_cost, profit_split, cost_owed_partner_id, serials)
      VALUES (_order_id, _item_id, _pid, _b.id, _b.batch_code, _take, _b.unit_cost, _b.landed_unit_cost, _b.profit_split, _b.cost_owed_partner_id, _b.sers);
      UPDATE public.inventory_batches SET remaining_qty = remaining_qty - _take WHERE id = _b.id;
      UPDATE public.serial_numbers SET status = 'sold', order_item_id = _item_id WHERE batch_id = _b.id AND serial = ANY(_b.sers);
      _need := _need - _take;
    END LOOP;
  ELSE
    FOR _b IN SELECT * FROM public.inventory_batches WHERE product_id = _pid AND remaining_qty > 0 ORDER BY received_at, created_at, id FOR UPDATE LOOP
      EXIT WHEN _need <= 0;
      _take := LEAST(_need, _b.remaining_qty);
      SELECT array_agg(serial ORDER BY serial) INTO _ser FROM (SELECT serial FROM public.serial_numbers WHERE batch_id = _b.id AND status = 'in_stock' ORDER BY serial LIMIT _take) s;
      INSERT INTO public.order_allocations(order_id, order_item_id, product_id, batch_id, batch_code, quantity, unit_item_cost, unit_landed_cost, profit_split, cost_owed_partner_id, serials)
      VALUES (_order_id, _item_id, _pid, _b.id, _b.batch_code, _take, _b.unit_cost, _b.landed_unit_cost, _b.profit_split, _b.cost_owed_partner_id, COALESCE(_ser, '{}'));
      UPDATE public.inventory_batches SET remaining_qty = remaining_qty - _take WHERE id = _b.id;
      IF _ser IS NOT NULL THEN UPDATE public.serial_numbers SET status = 'sold', order_item_id = _item_id WHERE batch_id = _b.id AND serial = ANY(_ser); END IF;
      _need := _need - _take;
    END LOOP;
  END IF;
  IF _need > 0 THEN
    INSERT INTO public.order_allocations(order_id, order_item_id, product_id, quantity, unit_item_cost, unit_landed_cost)
    VALUES (_order_id, _item_id, _pid, _need, _avg, _avg);
  END IF;
  UPDATE public.products SET stock_qty = stock_qty - _qty WHERE id = _pid;
  INSERT INTO public.stock_movements(product_id, change_qty, reason, note, user_id) VALUES (_pid, -_qty, 'sale', 'Order ' || _ref, auth.uid());
  UPDATE public.order_items oi SET
    unit_item_cost = x.ic, unit_landed_cost = x.lc, unit_cost = x.lc
  FROM (SELECT ROUND(SUM(quantity * unit_item_cost) / SUM(quantity), 2) ic, ROUND(SUM(quantity * unit_landed_cost) / SUM(quantity), 2) lc
        FROM public.order_allocations WHERE order_item_id = _item_id) x
  WHERE oi.id = _item_id;
END $$;

CREATE OR REPLACE FUNCTION public._release_order(_order_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a record; _ref text;
BEGIN
  SELECT COALESCE(order_number, id::text) INTO _ref FROM public.orders WHERE id = _order_id;
  FOR _a IN SELECT * FROM public.order_allocations WHERE order_id = _order_id LOOP
    IF _a.batch_id IS NOT NULL THEN
      UPDATE public.inventory_batches SET remaining_qty = remaining_qty + _a.quantity WHERE id = _a.batch_id;
    END IF;
    IF cardinality(_a.serials) > 0 THEN
      UPDATE public.serial_numbers SET status = 'in_stock', order_item_id = NULL WHERE product_id = _a.product_id AND serial = ANY(_a.serials);
    END IF;
    IF _a.product_id IS NOT NULL THEN
      UPDATE public.products SET stock_qty = stock_qty + _a.quantity WHERE id = _a.product_id;
      INSERT INTO public.stock_movements(product_id, batch_id, change_qty, reason, note, user_id)
      VALUES (_a.product_id, _a.batch_id, _a.quantity, _reason, 'Order ' || _ref, auth.uid());
    END IF;
  END LOOP;
  DELETE FROM public.order_allocations WHERE order_id = _order_id;
END $$;

CREATE OR REPLACE FUNCTION public._insert_order_lines(_order_id uuid, _lines jsonb, _allocate boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _l jsonb; _pid uuid; _qty int; _item uuid; _pack numeric; _ser text[];
BEGIN
  IF jsonb_array_length(COALESCE(_lines,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'NO_LINES'; END IF;
  FOR _l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    _pid := (_l->>'product_id')::uuid; _qty := (_l->>'quantity')::int;
    IF _pid IS NULL OR COALESCE(_qty,0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    SELECT packaging_cost_per_unit INTO _pack FROM public.products WHERE id = _pid;
    INSERT INTO public.order_items(order_id, product_id, quantity, sale_price, unit_cost, packaging_unit_cost)
    VALUES (_order_id, _pid, _qty, COALESCE((_l->>'sale_price')::numeric, 0), 0,
      COALESCE((_l->>'packaging_unit_cost')::numeric, _pack, 0))
    RETURNING id INTO _item;
    IF _allocate THEN
      SELECT array_agg(v) INTO _ser FROM jsonb_array_elements_text(COALESCE(_l->'serials','[]'::jsonb)) v;
      PERFORM public._alloc_item(_order_id, _item, _pid, _qty, _ser);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._apply_order_header(_id uuid, _order jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rev numeric; _fee jsonb; _manual boolean; _split jsonb; _pack numeric;
BEGIN
  _split := CASE WHEN jsonb_typeof(_order->'split_override') = 'array' AND jsonb_array_length(_order->'split_override') > 0 THEN _order->'split_override' ELSE NULL END;
  IF _split IS NOT NULL AND NOT public.split_valid(_split) THEN RAISE EXCEPTION 'SPLIT_NOT_100'; END IF;
  SELECT COALESCE(SUM(quantity * sale_price),0), COALESCE(SUM(quantity * packaging_unit_cost),0) INTO _rev, _pack FROM public.order_items WHERE order_id = _id;
  _fee := public.compute_platform_fee(_order->>'platform', _rev, (_order->>'order_date')::date);
  _manual := COALESCE((_order->>'platform_fee_manual')::boolean, false);
  UPDATE public.orders SET
    order_number = NULLIF(_order->>'order_number',''), order_date = (_order->>'order_date')::date, platform = _order->>'platform',
    customer_name = NULLIF(_order->>'customer_name',''), shipping_cost = COALESCE((_order->>'shipping_cost')::numeric,0),
    tax_amount = COALESCE((_order->>'tax_amount')::numeric,0), notes = NULLIF(_order->>'notes',''),
    platform_fee_auto = (_fee->>'amount')::numeric, fee_snapshot = _fee->'snapshot', platform_fee_manual = _manual,
    platform_fee = CASE WHEN _manual THEN COALESCE((_order->>'platform_fee')::numeric,0) ELSE (_fee->>'amount')::numeric END,
    packaging_cost = _pack, split_override = _split
  WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.create_order(_order jsonb, _lines jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _status text := COALESCE(_order->>'status','pending');
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.orders(order_number, order_date, platform, status, created_by)
  VALUES (NULLIF(_order->>'order_number',''), (_order->>'order_date')::date, _order->>'platform', _status, auth.uid())
  RETURNING id INTO _id;
  PERFORM public._insert_order_lines(_id, _lines, _status <> 'cancelled');
  PERFORM public._apply_order_header(_id, _order);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.update_order(_id uuid, _order jsonb, _lines jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _status text;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_returns WHERE order_id = _id) THEN RAISE EXCEPTION 'ORDER_HAS_RETURNS'; END IF;
  _status := COALESCE(_order->>'status', _o.status);
  PERFORM public._release_order(_id, 'order_edit');
  DELETE FROM public.order_items WHERE order_id = _id;
  UPDATE public.orders SET status = _status WHERE id = _id;
  PERFORM public._insert_order_lines(_id, _lines, _status <> 'cancelled');
  PERFORM public._apply_order_header(_id, _order);
END $$;

CREATE OR REPLACE FUNCTION public.delete_order(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM 1 FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_returns WHERE order_id = _id) THEN RAISE EXCEPTION 'ORDER_HAS_RETURNS'; END IF;
  PERFORM public._release_order(_id, 'order_deleted');
  DELETE FROM public.orders WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.set_order_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _it record;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status <> 'cancelled' AND _status = 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM public.order_returns WHERE order_id = _id) THEN RAISE EXCEPTION 'ORDER_HAS_RETURNS'; END IF;
    PERFORM public._release_order(_id, 'order_cancelled');
  ELSIF _o.status = 'cancelled' AND _status <> 'cancelled' THEN
    FOR _it IN SELECT * FROM public.order_items WHERE order_id = _id LOOP
      PERFORM public._alloc_item(_id, _it.id, _it.product_id, _it.quantity, NULL);
    END LOOP;
  END IF;
  UPDATE public.orders SET status = _status WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_return(_item_id uuid, _qty integer, _action text, _refund numeric, _refund_fee boolean, _date date, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _it record; _o record; _avail int; _rev numeric; _fee_ref numeric := 0; _ret uuid; _a record; _left int := _qty;
  _take int; _sers text[]; _all_sers text[] := '{}'; _r_part numeric; _f_part numeric; _r_used numeric := 0; _f_used numeric := 0;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _action NOT IN ('restock','loss') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  SELECT * INTO _it FROM public.order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _it.order_id;
  IF _o.status = 'cancelled' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
  SELECT COALESCE(SUM(quantity - returned_qty),0) INTO _avail FROM public.order_allocations WHERE order_item_id = _item_id;
  IF COALESCE(_qty,0) <= 0 OR _qty > _avail THEN RAISE EXCEPTION 'RETURN_QTY_INVALID: %', _avail; END IF;
  IF COALESCE(_refund,0) < 0 THEN RAISE EXCEPTION 'Refund must not be negative'; END IF;
  SELECT COALESCE(SUM(quantity * sale_price),0) INTO _rev FROM public.order_items WHERE order_id = _o.id;
  IF _refund_fee AND _rev > 0 THEN _fee_ref := ROUND(_o.platform_fee * COALESCE(_refund,0) / _rev, 2); END IF;
  INSERT INTO public.order_returns(order_id, order_item_id, return_date, quantity, action, refund_amount, refund_platform_fee, platform_fee_refunded, notes, created_by)
  VALUES (_o.id, _item_id, COALESCE(_date, CURRENT_DATE), _qty, _action, COALESCE(_refund,0), COALESCE(_refund_fee,false), _fee_ref, NULLIF(_notes,''), auth.uid())
  RETURNING id INTO _ret;
  FOR _a IN SELECT * FROM public.order_allocations WHERE order_item_id = _item_id AND quantity > returned_qty ORDER BY created_at, id FOR UPDATE LOOP
    EXIT WHEN _left <= 0;
    _take := LEAST(_left, _a.quantity - _a.returned_qty);
    SELECT array_agg(s) INTO _sers FROM (SELECT s FROM unnest(_a.serials) s WHERE NOT (s = ANY(_a.returned_serials)) ORDER BY s DESC LIMIT _take) q;
    _sers := COALESCE(_sers, '{}');
    _all_sers := _all_sers || _sers;
    IF _left - _take = 0 THEN _r_part := COALESCE(_refund,0) - _r_used; _f_part := _fee_ref - _f_used;
    ELSE _r_part := ROUND(COALESCE(_refund,0) * _take / _qty, 2); _f_part := ROUND(_fee_ref * _take / _qty, 2); END IF;
    _r_used := _r_used + _r_part; _f_used := _f_used + _f_part;
    UPDATE public.order_allocations SET returned_qty = returned_qty + _take, returned_serials = returned_serials || _sers,
      refund_amount = refund_amount + _r_part, fee_refunded = fee_refunded + _f_part WHERE id = _a.id;
    IF _action = 'restock' THEN
      IF _a.batch_id IS NOT NULL THEN UPDATE public.inventory_batches SET remaining_qty = remaining_qty + _take WHERE id = _a.batch_id; END IF;
      IF cardinality(_sers) > 0 THEN UPDATE public.serial_numbers SET status = 'in_stock', order_item_id = NULL WHERE product_id = _a.product_id AND serial = ANY(_sers); END IF;
      UPDATE public.products SET stock_qty = stock_qty + _take WHERE id = _a.product_id;
      INSERT INTO public.stock_movements(product_id, batch_id, change_qty, reason, note, user_id)
      VALUES (_a.product_id, _a.batch_id, _take, 'return_restock', 'Return ' || COALESCE(_o.order_number, _o.id::text), auth.uid());
    ELSE
      IF cardinality(_sers) > 0 THEN UPDATE public.serial_numbers SET status = 'written_off' WHERE product_id = _a.product_id AND serial = ANY(_sers); END IF;
      INSERT INTO public.stock_losses(loss_date, product_id, batch_id, batch_code, quantity, reason, is_marketing, unit_item_cost, unit_landed_cost, loss_amount,
        profit_split, cost_owed_partner_id, order_id, return_id, serials, notes, created_by)
      VALUES (COALESCE(_date, CURRENT_DATE), _a.product_id, _a.batch_id, _a.batch_code, _take, 'return_loss', false, _a.unit_item_cost, _a.unit_landed_cost,
        ROUND(_take * _a.unit_landed_cost, 2), CASE WHEN public.split_valid(_o.split_override) THEN _o.split_override ELSE _a.profit_split END,
        _a.cost_owed_partner_id, _o.id, _ret, _sers, NULLIF(_notes,''), auth.uid());
    END IF;
    _left := _left - _take;
  END LOOP;
  UPDATE public.order_returns SET serials = _all_sers WHERE id = _ret;
  RETURN _ret;
END $$;

CREATE OR REPLACE FUNCTION public.write_off_stock(_product_id uuid, _qty integer, _reason text, _date date, _notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _need int := _qty; _b record; _take int; _ser text[]; _stock int; _sku text; _avg numeric; _total numeric := 0; _mk boolean;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _reason NOT IN ('damaged','lost','sample','gift') THEN RAISE EXCEPTION 'Invalid reason'; END IF;
  _mk := _reason IN ('sample','gift');
  SELECT stock_qty, sku, COALESCE(NULLIF(avg_cost,0), cost_price, 0) INTO _stock, _sku, _avg FROM public.products WHERE id = _product_id FOR UPDATE;
  IF _stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF COALESCE(_qty,0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF _qty > _stock THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK: % (available %)', _sku, _stock; END IF;
  FOR _b IN SELECT * FROM public.inventory_batches WHERE product_id = _product_id AND remaining_qty > 0 ORDER BY received_at, created_at, id FOR UPDATE LOOP
    EXIT WHEN _need <= 0;
    _take := LEAST(_need, _b.remaining_qty);
    SELECT array_agg(serial ORDER BY serial) INTO _ser FROM (SELECT serial FROM public.serial_numbers WHERE batch_id = _b.id AND status = 'in_stock' ORDER BY serial LIMIT _take) s;
    UPDATE public.inventory_batches SET remaining_qty = remaining_qty - _take WHERE id = _b.id;
    IF _ser IS NOT NULL THEN UPDATE public.serial_numbers SET status = 'written_off' WHERE batch_id = _b.id AND serial = ANY(_ser); END IF;
    INSERT INTO public.stock_losses(loss_date, product_id, batch_id, batch_code, quantity, reason, is_marketing, unit_item_cost, unit_landed_cost, loss_amount, profit_split, cost_owed_partner_id, serials, notes, created_by)
    VALUES (COALESCE(_date, CURRENT_DATE), _product_id, _b.id, _b.batch_code, _take, _reason, _mk, _b.unit_cost, _b.landed_unit_cost, ROUND(_take * _b.landed_unit_cost, 2),
      _b.profit_split, _b.cost_owed_partner_id, COALESCE(_ser,'{}'), NULLIF(_notes,''), auth.uid());
    _total := _total + ROUND(_take * _b.landed_unit_cost, 2);
    _need := _need - _take;
  END LOOP;
  IF _need > 0 THEN
    INSERT INTO public.stock_losses(loss_date, product_id, quantity, reason, is_marketing, unit_item_cost, unit_landed_cost, loss_amount, notes, created_by)
    VALUES (COALESCE(_date, CURRENT_DATE), _product_id, _need, _reason, _mk, _avg, _avg, ROUND(_need * _avg, 2), NULLIF(_notes,''), auth.uid());
    _total := _total + ROUND(_need * _avg, 2);
  END IF;
  UPDATE public.products SET stock_qty = stock_qty - _qty WHERE id = _product_id;
  INSERT INTO public.stock_movements(product_id, change_qty, reason, note, user_id) VALUES (_product_id, -_qty, 'write_off_' || _reason, NULLIF(_notes,''), auth.uid());
  RETURN jsonb_build_object('loss_amount', _total, 'quantity', _qty);
END $$;

CREATE OR REPLACE VIEW public.order_line_profit WITH (security_invoker = true) AS
SELECT a.id AS allocation_id, a.order_id, a.order_item_id, a.product_id, a.batch_id, a.batch_code, o.order_date, o.status,
  a.quantity, a.returned_qty, a.serials, a.returned_serials, oi.sale_price, a.unit_item_cost, a.unit_landed_cost,
  ROUND(a.quantity * oi.sale_price - a.refund_amount, 2) AS net_revenue,
  ROUND((a.quantity - a.returned_qty) * a.unit_landed_cost, 2) AS landed_cost,
  ROUND(o.platform_fee * sh.share - a.fee_refunded, 2) AS platform_fee_share,
  ROUND((o.shipping_cost + o.tax_amount) * sh.share, 2) AS shipping_tax_share,
  ROUND(a.quantity * oi.packaging_unit_cost, 2) AS packaging_cost,
  ROUND(a.quantity * oi.sale_price - a.refund_amount - (a.quantity - a.returned_qty) * a.unit_landed_cost
    - (o.platform_fee * sh.share - a.fee_refunded) - (o.shipping_cost + o.tax_amount) * sh.share - a.quantity * oi.packaging_unit_cost, 2) AS profit,
  ROUND((a.quantity - a.returned_qty) * a.unit_item_cost, 2) AS item_cost_owed,
  a.cost_owed_partner_id,
  CASE WHEN public.split_valid(o.split_override) THEN o.split_override ELSE a.profit_split END AS effective_split,
  NOT public.split_valid(CASE WHEN public.split_valid(o.split_override) THEN o.split_override ELSE a.profit_split END) AS split_missing
FROM public.order_allocations a
JOIN public.order_items oi ON oi.id = a.order_item_id
JOIN public.orders o ON o.id = a.order_id
CROSS JOIN LATERAL (SELECT CASE WHEN t.total > 0 THEN (a.quantity * oi.sale_price) / t.total ELSE 0 END AS share
  FROM (SELECT SUM(quantity * sale_price) total FROM public.order_items WHERE order_id = o.id) t) sh;
GRANT SELECT ON public.order_line_profit TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_month_summary(_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _start date := date_trunc('month', _month)::date; _end date := (date_trunc('month', _month) + interval '1 month')::date;
  _st text[]; _out jsonb;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT counting_statuses INTO _st FROM public.app_settings LIMIT 1;
  _st := COALESCE(_st, '{delivered,completed}');
  WITH lp AS (SELECT * FROM public.order_line_profit WHERE order_date >= _start AND order_date < _end AND status = ANY(_st)),
  ls AS (SELECT * FROM public.stock_losses WHERE loss_date >= _start AND loss_date < _end),
  ps AS (
    SELECT (x->>'partner_id')::uuid pid, SUM(lp.profit * (x->>'percent')::numeric / 100) profit, 0::numeric loss
      FROM lp, jsonb_array_elements(lp.effective_split) x WHERE NOT lp.split_missing GROUP BY 1
    UNION ALL
    SELECT (x->>'partner_id')::uuid, 0, SUM(ls.loss_amount * (x->>'percent')::numeric / 100)
      FROM ls, jsonb_array_elements(ls.profit_split) x WHERE public.split_valid(ls.profit_split) GROUP BY 1),
  co AS (
    SELECT cost_owed_partner_id pid, SUM(item_cost_owed) owed FROM lp WHERE cost_owed_partner_id IS NOT NULL GROUP BY 1
    UNION ALL
    SELECT cost_owed_partner_id, SUM(quantity * unit_item_cost) FROM ls WHERE cost_owed_partner_id IS NOT NULL GROUP BY 1)
  SELECT jsonb_build_object(
    'month', to_char(_start, 'YYYY-MM'), 'counting_statuses', to_jsonb(_st),
    'order_profit', COALESCE((SELECT ROUND(SUM(profit),2) FROM lp),0),
    'losses', COALESCE((SELECT ROUND(SUM(loss_amount),2) FROM ls),0),
    'unallocated_profit', COALESCE((SELECT ROUND(SUM(profit),2) FROM lp WHERE split_missing),0),
    'unallocated_losses', COALESCE((SELECT ROUND(SUM(loss_amount),2) FROM ls WHERE NOT public.split_valid(profit_split)),0),
    'partners', COALESCE((SELECT jsonb_agg(jsonb_build_object('partner_id', p.id, 'name', p.name,
        'profit_share', ROUND(COALESCE((SELECT SUM(profit) FROM ps WHERE pid = p.id),0),2),
        'loss_share', ROUND(COALESCE((SELECT SUM(loss) FROM ps WHERE pid = p.id),0),2),
        'net_share', ROUND(COALESCE((SELECT SUM(profit - loss) FROM ps WHERE pid = p.id),0),2),
        'item_cost_owed', ROUND(COALESCE((SELECT SUM(owed) FROM co WHERE pid = p.id),0),2)) ORDER BY p.name)
      FROM public.partners p), '[]'::jsonb)) INTO _out;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.undo_shipment_receipt(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _s RECORD; _it RECORD; _qty int; _avg numeric; _rest int;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _s FROM public.shipments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF _s.status <> 'added_to_inventory' THEN RAISE EXCEPTION 'NOT_RECEIVED'; END IF;
  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _id LOOP
    SELECT stock_qty, avg_cost INTO _qty, _avg FROM public.products WHERE id = _it.product_id FOR UPDATE;
    IF _qty < _it.quantity THEN RAISE EXCEPTION 'STOCK_ALREADY_SOLD'; END IF;
    IF _it.batch_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.inventory_batches WHERE id = _it.batch_id AND remaining_qty < quantity) THEN RAISE EXCEPTION 'STOCK_ALREADY_SOLD'; END IF;
    _rest := _qty - _it.quantity;
    UPDATE public.products SET stock_qty = _rest,
      avg_cost = CASE WHEN _rest > 0 THEN GREATEST(ROUND((_qty * _avg - _it.quantity * _it.landed_unit_cost) / _rest, 2), 0) ELSE avg_cost END
      WHERE id = _it.product_id;
    INSERT INTO public.stock_movements(product_id, change_qty, reason, note, user_id)
      VALUES (_it.product_id, -_it.quantity, 'shipment_undo', 'Undo shipment ' || _s.reference, auth.uid());
    IF _it.batch_id IS NOT NULL THEN
      DELETE FROM public.serial_numbers WHERE batch_id = _it.batch_id;
      UPDATE public.stock_movements SET batch_id = NULL WHERE batch_id = _it.batch_id;
      UPDATE public.shipment_items SET batch_id = NULL, batch_code = NULL, first_serial = NULL, last_serial = NULL WHERE id = _it.id;
      DELETE FROM public.inventory_batches WHERE id = _it.batch_id;
    END IF;
  END LOOP;
  DELETE FROM public.margin_history WHERE shipment_id = _id;
  UPDATE public.shipments SET status = 'arrived_in_malaysia', received_at = NULL,
    status_dates = status_dates - 'added_to_inventory' WHERE id = _id;
END $function$;

REVOKE EXECUTE ON FUNCTION public._alloc_item(uuid, uuid, uuid, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._release_order(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._insert_order_lines(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._apply_order_header(uuid, jsonb) FROM PUBLIC, anon, authenticated;
