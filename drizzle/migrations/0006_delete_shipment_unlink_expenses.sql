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
  UPDATE public.expenses SET shipment_id = NULL WHERE shipment_id = _id;
  DELETE FROM public.shipments WHERE id = _id;
END $$;