CREATE TABLE public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT '',
  handle text,
  contact text,
  commission_percent numeric NOT NULL DEFAULT 0 CHECK (commission_percent >= 0 AND commission_percent <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creator_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  sent_on date NOT NULL DEFAULT CURRENT_DATE,
  cost_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creator_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  orders integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  contact text,
  platform text,
  notes text,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creators, public.creator_results, public.waitlist TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.creator_samples TO authenticated;
GRANT ALL ON public.creators, public.creator_samples, public.creator_results, public.waitlist TO service_role;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk manage creators" ON public.creators FOR ALL TO authenticated USING (public.is_marketing()) WITH CHECK (public.is_marketing());
CREATE POLICY "mk read samples" ON public.creator_samples FOR SELECT TO authenticated USING (public.is_marketing());
CREATE POLICY "mk edit samples" ON public.creator_samples FOR UPDATE TO authenticated USING (public.is_marketing()) WITH CHECK (public.is_marketing());
CREATE POLICY "owner delete samples" ON public.creator_samples FOR DELETE TO authenticated USING (public.is_owner());
CREATE POLICY "mk manage results" ON public.creator_results FOR ALL TO authenticated USING (public.is_marketing()) WITH CHECK (public.is_marketing());
CREATE POLICY "team manage waitlist" ON public.waitlist FOR ALL TO authenticated USING (public.has_any_role()) WITH CHECK (public.has_any_role());
CREATE TRIGGER creators_touch BEFORE UPDATE ON public.creators FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_creators AFTER INSERT OR UPDATE OR DELETE ON public.creators FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_creator_samples AFTER INSERT OR UPDATE OR DELETE ON public.creator_samples FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_creator_results AFTER INSERT OR UPDATE OR DELETE ON public.creator_results FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_waitlist AFTER INSERT OR UPDATE OR DELETE ON public.waitlist FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

CREATE OR REPLACE FUNCTION public.send_creator_sample(_creator_id uuid, _product_id uuid, _qty integer, _date date, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _r jsonb; _id uuid; _name text;
BEGIN
  IF NOT public.is_ops() AND NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT name INTO _name FROM public.creators WHERE id = _creator_id;
  IF _name IS NULL THEN RAISE EXCEPTION 'Creator not found'; END IF;
  _r := public.write_off_stock(_product_id, _qty, 'sample', _date, trim(concat('Creator sample: ', _name, ' ', coalesce(_notes,''))));
  INSERT INTO public.creator_samples(creator_id, product_id, quantity, sent_on, cost_amount, notes, created_by)
  VALUES (_creator_id, _product_id, _qty, COALESCE(_date, CURRENT_DATE), COALESCE((_r->>'loss_amount')::numeric,0), NULLIF(_notes,''), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_creator_sample(uuid, uuid, integer, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_creator_sample(uuid, uuid, integer, date, text) TO authenticated;