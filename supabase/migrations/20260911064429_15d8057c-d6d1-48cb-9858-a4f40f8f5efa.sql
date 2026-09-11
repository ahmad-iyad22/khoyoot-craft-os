-- ROLES
CREATE TYPE public.app_role AS ENUM ('owner','operations','marketing');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner')
$$;
CREATE OR REPLACE FUNCTION public.is_ops() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'operations')
$$;
CREATE OR REPLACE FUNCTION public.is_marketing() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'marketing')
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_owner()) WITH CHECK (id = auth.uid() OR public.is_owner());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_owner());

CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles managed by owner" ON public.user_roles FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CATALOG
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories write" ON public.categories FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  products_supplied TEXT,
  lead_time_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers ops" ON public.suppliers FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 0,
  tracks_serials BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products ops" ON public.products FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- marketing-safe product view (no cost data)
CREATE VIEW public.products_basic AS
  SELECT id, sku, name, name_ar, category_id, sale_price, stock_qty, archived FROM public.products;
GRANT SELECT ON public.products_basic TO authenticated;

CREATE TABLE public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  batch_code TEXT,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  landed_unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_batches TO authenticated;
GRANT ALL ON public.inventory_batches TO service_role;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches ops" ON public.inventory_batches FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

CREATE TABLE public.serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  serial TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_stock',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, serial)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.serial_numbers TO authenticated;
GRANT ALL ON public.serial_numbers TO service_role;
ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "serials ops" ON public.serial_numbers FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  change_qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements ops" ON public.stock_movements FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  platform TEXT NOT NULL DEFAULT 'Manual',
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders ops" ON public.orders FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items ops" ON public.order_items FOR ALL TO authenticated USING (public.is_ops()) WITH CHECK (public.is_ops());

-- marketing-safe sales performance (revenue and units only, no cost)
CREATE VIEW public.sales_performance AS
  SELECT p.id AS product_id, p.name, p.sku, o.platform,
         date_trunc('month', o.order_date)::date AS month,
         SUM(oi.quantity) AS units_sold,
         SUM(oi.quantity * oi.sale_price) AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.status <> 'cancelled'
  GROUP BY p.id, p.name, p.sku, o.platform, date_trunc('month', o.order_date);
GRANT SELECT ON public.sales_performance TO authenticated;

-- FINANCE
CREATE TABLE public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'sale',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income TO authenticated;
GRANT ALL ON public.income TO service_role;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income owner" ON public.income FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses owner" ON public.expenses FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  share_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners owner" ON public.partners FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.partner_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL DEFAULT 'contribution',
  amount NUMERIC(12,2) NOT NULL,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_transactions TO authenticated;
GRANT ALL ON public.partner_transactions TO service_role;
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner txn owner" ON public.partner_transactions FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fees read" ON public.platform_fees FOR SELECT TO authenticated USING (true);
CREATE POLICY "fees owner write" ON public.platform_fees FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks all authed" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- MARKETING
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'TikTok',
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns marketing" ON public.campaigns FOR ALL TO authenticated USING (public.is_marketing()) WITH CHECK (public.is_marketing());
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'Instagram',
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'idea',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_calendar TO authenticated;
GRANT ALL ON public.content_calendar TO service_role;
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content marketing" ON public.content_calendar FOR ALL TO authenticated USING (public.is_marketing()) WITH CHECK (public.is_marketing());
CREATE TRIGGER content_touch BEFORE UPDATE ON public.content_calendar FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- stock receiving helper: updates stock + weighted average cost, logs movement
CREATE OR REPLACE FUNCTION public.receive_stock(
  _product_id UUID, _quantity INTEGER, _unit_cost NUMERIC, _shipping_cost NUMERIC,
  _supplier_id UUID DEFAULT NULL, _batch_code TEXT DEFAULT NULL,
  _received_at DATE DEFAULT CURRENT_DATE, _notes TEXT DEFAULT NULL,
  _serials TEXT[] DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _batch_id UUID;
  _landed NUMERIC(12,2);
  _old_qty INTEGER;
  _old_avg NUMERIC(12,2);
  _s TEXT;
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  _landed := ROUND(_unit_cost + (COALESCE(_shipping_cost,0) / _quantity), 2);

  INSERT INTO public.inventory_batches (product_id, supplier_id, batch_code, quantity, unit_cost, shipping_cost, landed_unit_cost, received_at, notes, created_by)
  VALUES (_product_id, _supplier_id, _batch_code, _quantity, _unit_cost, COALESCE(_shipping_cost,0), _landed, COALESCE(_received_at, CURRENT_DATE), _notes, auth.uid())
  RETURNING id INTO _batch_id;

  SELECT stock_qty, avg_cost INTO _old_qty, _old_avg FROM public.products WHERE id = _product_id FOR UPDATE;

  UPDATE public.products SET
    stock_qty = _old_qty + _quantity,
    avg_cost = ROUND(((_old_qty * _old_avg) + (_quantity * _landed)) / NULLIF(_old_qty + _quantity, 0), 2),
    cost_price = _landed
  WHERE id = _product_id;

  INSERT INTO public.stock_movements (product_id, batch_id, change_qty, reason, note, user_id)
  VALUES (_product_id, _batch_id, _quantity, 'received', _notes, auth.uid());

  IF _serials IS NOT NULL THEN
    FOREACH _s IN ARRAY _serials LOOP
      IF length(trim(_s)) > 0 THEN
        INSERT INTO public.serial_numbers (product_id, batch_id, serial)
        VALUES (_product_id, _batch_id, trim(_s))
        ON CONFLICT (product_id, serial) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN _batch_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.receive_stock(UUID,INTEGER,NUMERIC,NUMERIC,UUID,TEXT,DATE,TEXT,TEXT[]) TO authenticated;

-- adjust stock manually
CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id UUID, _change INTEGER, _reason TEXT, _note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_ops() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.products SET stock_qty = stock_qty + _change WHERE id = _product_id;
  INSERT INTO public.stock_movements (product_id, change_qty, reason, note, user_id)
  VALUES (_product_id, _change, _reason, _note, auth.uid());
END; $$;
GRANT EXECUTE ON FUNCTION public.adjust_stock(UUID,INTEGER,TEXT,TEXT) TO authenticated;

INSERT INTO public.platform_fees (platform, fee_percent) VALUES
  ('Shopee', 5.00), ('Lazada', 4.50), ('TikTok Shop', 5.50), ('Manual', 0);

INSERT INTO public.categories (name, name_ar) VALUES
  ('Embroidery', 'تطريز'), ('Ceramics', 'خزف'), ('Olive Wood', 'خشب الزيتون'), ('Food & Spices', 'أطعمة وتوابل');
