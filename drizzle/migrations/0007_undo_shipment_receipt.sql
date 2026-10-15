CREATE OR REPLACE FUNCTION public.undo_shipment_receipt(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _s RECORD; _it RECORD; _qty int; _avg numeric; _rest int;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _s FROM public.shipments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF _s.status <> 'added_to_inventory' THEN RAISE EXCEPTION 'NOT_RECEIVED'; END IF;
  FOR _it IN SELECT * FROM public.shipment_items WHERE shipment_id = _id LOOP
    SELECT stock_qty, avg_cost INTO _qty, _avg FROM public.products WHERE id = _it.product_id FOR UPDATE;
    IF _qty < _it.quantity THEN RAISE EXCEPTION 'STOCK_ALREADY_SOLD'; END IF;
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
END $$;
GRANT EXECUTE ON FUNCTION public.undo_shipment_receipt(uuid) TO authenticated;