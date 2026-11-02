CREATE TABLE public.assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(trim(name)) > 0), category text NOT NULL,
 purchase_date date NOT NULL, amount numeric NOT NULL CHECK (amount > 0),
 currency text NOT NULL, fx_rate_to_base numeric NOT NULL CHECK (fx_rate_to_base > 0), base_amount numeric NOT NULL DEFAULT 0,
 paid_by_partner_id uuid REFERENCES public.partners(id),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','written_off')),
 notes text, receipt_path text, expense_id uuid UNIQUE REFERENCES public.expenses(id) ON DELETE SET NULL,
 expense_splits jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets owner only" ON public.assets FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE OR REPLACE FUNCTION public.sync_asset_expense() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expense uuid; v_splits jsonb; v_n integer;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF TG_OP = 'DELETE' THEN
   DELETE FROM public.expenses WHERE id=OLD.expense_id;
   RETURN OLD;
 END IF;
 NEW.name:=trim(NEW.name); NEW.category:=trim(NEW.category);
 IF NEW.category='' THEN RAISE EXCEPTION 'Category required'; END IF;
 NEW.base_amount:=round(NEW.amount*NEW.fx_rate_to_base,2); NEW.updated_at:=now();
 IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid(); NEW.expense_id:=NULL;
 ELSE NEW.created_by:=OLD.created_by; NEW.expense_id:=OLD.expense_id; END IF;
 IF NEW.paid_by_partner_id IS NULL THEN
   v_expense:=NEW.expense_id; NEW.expense_id:=NULL;
   DELETE FROM public.expenses WHERE id=v_expense;
 ELSE
   INSERT INTO public.expense_categories(code,label,label_ar,is_shared) VALUES ('equipment','Equipment','معدات',true) ON CONFLICT (code) DO NOTHING;
   v_splits:=NEW.expense_splits;
   IF jsonb_array_length(v_splits)=0 THEN
     SELECT count(*) INTO v_n FROM public.partners WHERE active;
     IF v_n=0 THEN RAISE EXCEPTION 'No active partners'; END IF;
     SELECT jsonb_agg(jsonb_build_object('partner_id',id,'percent',100::numeric/v_n) ORDER BY id) INTO v_splits FROM public.partners WHERE active;
   END IF;
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_splits) s WHERE (s->>'percent')::numeric IS NULL OR (s->>'percent')::numeric < 0 OR (s->>'percent')::numeric > 100)
      OR (SELECT count(*) FROM jsonb_array_elements(v_splits)) <> (SELECT count(DISTINCT s->>'partner_id') FROM jsonb_array_elements(v_splits) s) THEN RAISE EXCEPTION 'SPLIT_NOT_100'; END IF;
   NEW.expense_splits:=v_splits;
   NEW.expense_id:=public.save_shared_expense(NEW.expense_id,jsonb_build_object('entry_date',NEW.purchase_date,'category','equipment','amount',NEW.amount,'currency',NEW.currency,'fx_rate_to_base',NEW.fx_rate_to_base,'description',NEW.name,'paid_by_partner_id',NEW.paid_by_partner_id,'paid_by_business',false,'split_mode','percent','receipt_path',NEW.receipt_path),v_splits);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assets_sync BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.sync_asset_expense();
CREATE TRIGGER assets_remove_expense AFTER DELETE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.sync_asset_expense();
CREATE TRIGGER audit_assets AFTER INSERT OR UPDATE OR DELETE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();