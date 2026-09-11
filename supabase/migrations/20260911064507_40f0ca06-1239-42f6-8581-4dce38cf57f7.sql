DROP VIEW IF EXISTS public.products_basic;
DROP VIEW IF EXISTS public.sales_performance;

CREATE OR REPLACE FUNCTION public.get_products_basic()
RETURNS TABLE (id UUID, sku TEXT, name TEXT, name_ar TEXT, category_id UUID, sale_price NUMERIC, stock_qty INTEGER, archived BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.sku, p.name, p.name_ar, p.category_id, p.sale_price, p.stock_qty, p.archived
  FROM public.products p
  WHERE auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_sales_performance()
RETURNS TABLE (product_id UUID, name TEXT, sku TEXT, platform TEXT, month DATE, units_sold BIGINT, revenue NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.sku, o.platform, date_trunc('month', o.order_date)::date,
         SUM(oi.quantity)::bigint, SUM(oi.quantity * oi.sale_price)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.status <> 'cancelled' AND auth.uid() IS NOT NULL
  GROUP BY p.id, p.name, p.sku, o.platform, date_trunc('month', o.order_date)
$$;

REVOKE EXECUTE ON FUNCTION public.get_products_basic() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_sales_performance() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_products_basic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_performance() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ops() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_ops() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_marketing() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_marketing() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.receive_stock(UUID,INTEGER,NUMERIC,NUMERIC,UUID,TEXT,DATE,TEXT,TEXT[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receive_stock(UUID,INTEGER,NUMERIC,NUMERIC,UUID,TEXT,DATE,TEXT,TEXT[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(UUID,INTEGER,TEXT,TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.adjust_stock(UUID,INTEGER,TEXT,TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, public, authenticated;