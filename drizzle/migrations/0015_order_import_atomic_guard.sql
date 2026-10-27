CREATE OR REPLACE FUNCTION public.import_order(_order jsonb, _lines jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _ref text := btrim(_order->>'order_number'); _platform text := _order->>'platform'; _id uuid; _line jsonb;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF coalesce(_ref,'')='' OR length(_ref)>200 THEN RAISE EXCEPTION 'IMPORT_REFERENCE_REQUIRED'; END IF;
 IF _platform NOT IN ('Shopee','TikTok Shop','Lazada') THEN RAISE EXCEPTION 'IMPORT_PLATFORM_INVALID'; END IF;
 IF coalesce(_order->>'status','') NOT IN ('pending','shipped','delivered','completed','cancelled') THEN RAISE EXCEPTION 'IMPORT_STATUS_INVALID'; END IF;
 IF jsonb_typeof(_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(_lines)=0 OR jsonb_array_length(_lines)>500 THEN RAISE EXCEPTION 'IMPORT_LINES_INVALID'; END IF;
 FOR _line IN SELECT value FROM jsonb_array_elements(_lines) LOOP
  IF (_line->>'quantity')::numeric <=0 OR (_line->>'quantity')::numeric <> trunc((_line->>'quantity')::numeric) OR (_line->>'sale_price')::numeric <0 OR _line->>'sale_price' IS NULL OR _line->>'quantity' IS NULL THEN RAISE EXCEPTION 'IMPORT_LINE_INVALID'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=(_line->>'product_id')::uuid AND NOT archived AND status IN ('active','out_of_stock')) THEN RAISE EXCEPTION 'IMPORT_PRODUCT_INVALID'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(_platform || ':' || _ref, 0));
 IF EXISTS (SELECT 1 FROM public.orders WHERE platform=_platform AND order_number=_ref) THEN RETURN jsonb_build_object('status','duplicate'); END IF;
 _id:=public.create_order(_order || jsonb_build_object('order_number',_ref,'platform_fee_manual',false),_lines);
 RETURN jsonb_build_object('status','created','id',_id);
END; $$;
REVOKE ALL ON FUNCTION public.import_order(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_order(jsonb,jsonb) TO authenticated, service_role;