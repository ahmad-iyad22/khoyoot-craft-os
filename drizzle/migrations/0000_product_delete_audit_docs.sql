ALTER TABLE public.shipment_items DROP CONSTRAINT shipment_items_product_id_fkey;
ALTER TABLE public.shipment_items ADD CONSTRAINT shipment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  table_name text NOT NULL,
  action text NOT NULL,
  record_id uuid,
  summary text,
  old_data jsonb,
  new_data jsonb
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_owner());

CREATE OR REPLACE FUNCTION public.audit_sensitive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _summary text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(table_name, action, record_id, summary, old_data)
    VALUES (TG_TABLE_NAME, 'delete', OLD.id, 'Deleted ' || TG_TABLE_NAME, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'products' THEN
      IF NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
        INSERT INTO public.audit_log(table_name, action, record_id, summary, old_data, new_data)
        VALUES ('products','price_change', NEW.id, NEW.name || ': ' || OLD.sale_price || ' → ' || NEW.sale_price,
                jsonb_build_object('sale_price', OLD.sale_price), jsonb_build_object('sale_price', NEW.sale_price));
      END IF;
    ELSIF TG_TABLE_NAME = 'partners' THEN
      IF NEW.share_percent IS DISTINCT FROM OLD.share_percent OR NEW.expense_share_percent IS DISTINCT FROM OLD.expense_share_percent THEN
        INSERT INTO public.audit_log(table_name, action, record_id, summary, old_data, new_data)
        VALUES ('partners','share_change', NEW.id, NEW.name || ' shares changed',
          jsonb_build_object('share', OLD.share_percent, 'expense_share', OLD.expense_share_percent),
          jsonb_build_object('share', NEW.share_percent, 'expense_share', NEW.expense_share_percent));
      END IF;
    END IF;
    RETURN NEW;
  ELSE
    IF TG_TABLE_NAME = 'partner_transactions' AND NEW.txn_type = 'withdrawal' THEN
      INSERT INTO public.audit_log(table_name, action, record_id, summary, new_data)
      VALUES ('partner_transactions','withdrawal', NEW.id, 'Withdrawal ' || NEW.amount, to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER audit_products AFTER UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_partners AFTER UPDATE OR DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_partner_txn AFTER INSERT OR DELETE ON public.partner_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_expenses AFTER DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_orders AFTER DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();
CREATE TRIGGER audit_shipments AFTER DELETE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive();

CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  url text NOT NULL,
  doc_date date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages docs" ON public.company_documents FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
