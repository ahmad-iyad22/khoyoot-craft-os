CREATE OR REPLACE FUNCTION public.audit_sensitive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _rid uuid; _o jsonb; _n jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN _o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN _n := to_jsonb(NEW); END IF;
  BEGIN _rid := (COALESCE(_n, _o)->>'id')::uuid; EXCEPTION WHEN others THEN _rid := NULL; END;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, old_data)
    VALUES (auth.uid(), TG_TABLE_NAME, 'delete', _rid, 'Deleted ' || TG_TABLE_NAME, _o);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (_n - 'updated_at') = (_o - 'updated_at') THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'products' AND (_n->>'sale_price') IS DISTINCT FROM (_o->>'sale_price') THEN
      INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, old_data, new_data)
      VALUES (auth.uid(), 'products', 'price_change', _rid, (_n->>'name') || ': ' || (_o->>'sale_price') || ' → ' || (_n->>'sale_price'),
              jsonb_build_object('sale_price', _o->'sale_price'), jsonb_build_object('sale_price', _n->'sale_price'));
    ELSE
      INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, old_data, new_data)
      VALUES (auth.uid(), TG_TABLE_NAME, 'update', _rid, 'Updated ' || TG_TABLE_NAME, _o, _n);
    END IF;
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_log(user_id, table_name, action, record_id, summary, new_data)
  VALUES (auth.uid(), TG_TABLE_NAME, CASE WHEN TG_TABLE_NAME = 'partner_transactions' AND _n->>'txn_type' = 'withdrawal' THEN 'withdrawal' ELSE 'create' END,
          _rid, 'Created ' || TG_TABLE_NAME, _n);
  RETURN NEW;
END; $function$;