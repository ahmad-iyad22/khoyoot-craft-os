CREATE OR REPLACE FUNCTION public.set_approval_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _th numeric; _amt numeric;
BEGIN
  IF TG_TABLE_NAME='partner_transactions' THEN
    IF to_jsonb(NEW)->>'txn_type' IS DISTINCT FROM 'paid_on_behalf' THEN NEW.approval_status:='approved'; RETURN NEW; END IF;
  END IF;
  SELECT approval_threshold INTO _th FROM app_settings LIMIT 1;
  _amt := COALESCE(NEW.base_amount, NEW.amount*COALESCE(NEW.fx_rate_to_base,1));
  NEW.approval_status := CASE WHEN COALESCE(_th,0)>0 AND _amt>_th THEN 'pending' ELSE 'approved' END;
  RETURN NEW;
END $$;