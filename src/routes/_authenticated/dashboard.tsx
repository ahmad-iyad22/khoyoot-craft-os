import { BudgetStatus } from "@/components/category-budgets";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EInvoiceWarning } from "@/components/einvoice-warning";
import { WorkOverview } from "@/components/work-overview";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n , tt } from "@/lib/i18n";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { MonthEndCards } from "@/components/month-end-cards";
import { compactMoney, formatDate, money, pct, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Khoyoot" },
      { name: "description", content: "Revenue, profit, stock value and recent orders at a glance." },
      { property: "og:title", content: "Dashboard — Khoyoot" },
      { property: "og:description", content: "Revenue, profit, stock value and recent orders at a glance." },
    ],
  }),
  component: Dashboard,
});

type OrderRow = {
  id: string;
  order_date: string;
  platform: string;
  status: string;
  customer_name: string | null;
  order_items: { quantity: number; sale_price: number; unit_cost: number; product_id: string | null }[];
};

function monthLabel(d: Date, lang: string) {
  return d.toLocaleString(lang === "ar" ? "ar" : "en", { month: "short" });
}

function Dashboard() {
  const roles = useRoles();
  const { t, ts, lang } = useI18n();
  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  const sinceIso = since.toISOString().slice(0, 10);

  const ordersQ = useQuery({
    queryKey: ["dash-orders", sinceIso],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_date, platform, status, customer_name, order_items(quantity, sale_price, unit_cost, product_id)")
        .gte("order_date", sinceIso)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["dash-products"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, stock_qty, avg_cost, reorder_threshold, archived")
        .eq("archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sumQ = useQuery({
    queryKey: ["dash-summary", sinceIso],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_summary" as never, { _month: new Date().toISOString().slice(0, 8) + "01" } as never);
      if (error) throw error;
      return data as unknown as { months: any[]; top: { name: string; profit: number }[] };
    },
  });

  const salesQ = useQuery({
    queryKey: ["dash-sales-perf"],
    enabled: !roles.isOperations && roles.isMarketing,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_performance");
      if (error) throw error;
      return data ?? [];
    },
  });

  const orders = ordersQ.data ?? [];
  const products = productsQ.data ?? [];

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });

  const monthly = months.map((d, i) => {
    const m = sumQ.data?.months?.[i];
    return {
      label: monthLabel(d, lang),
      revenue: Number(m?.revenue ?? 0),
      orders: Number(m?.orders ?? 0),
      profit: Number(m?.net_profit ?? 0),
      shared: Number(m?.shared_costs ?? 0),
      unallocated: Number(m?.unallocated ?? 0),
    };
  });

  const emptyMonth = { label: "", revenue: 0, orders: 0, profit: 0, shared: 0, unallocated: 0 };
  const cur = monthly[monthly.length - 1] ?? emptyMonth;
  const prev = monthly[monthly.length - 2] ?? emptyMonth;
  const stockValue = products.reduce((s, p) => s + Number(p.stock_qty) * Number(p.avg_cost), 0);
  const lowStock = products.filter((p) => Number(p.stock_qty) <= Number(p.reorder_threshold));

  const profitByProduct = (sumQ.data?.top ?? []).map((r) => ({ name: r.name, profit: Number(r.profit) }));

  if (!roles.isOperations && roles.isMarketing) {
    const rows = (salesQ.data ?? []) as {
      name: string;
      platform: string;
      month: string;
      units_sold: number;
      revenue: number;
    }[];
    const byProduct = new Map<string, { units: number; revenue: number }>();
    rows.forEach((r) => {
      const e = byProduct.get(r.name) ?? { units: 0, revenue: 0 };
      byProduct.set(r.name, { units: e.units + Number(r.units_sold), revenue: e.revenue + Number(r.revenue) });
    });
    const top = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);

    return (
      <div>
        <PageHeader
          title={t("salesPerformance")}
          description={tt("Which products and platforms sell \u2014 costs and financial records stay with the Owner.")}
        />
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("product")}</th>
                <th className="px-4 py-3">{t("unitsSold")}</th>
                <th className="px-4 py-3">{t("revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {top.map(([name, v]) => (
                <tr key={name} className="border-t">
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3">{v.units}</td>
                  <td className="px-4 py-3">{money(v.revenue)}</td>
                </tr>
              ))}
              {!top.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    {tt("No sales recorded yet.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard")}
        description={`${new Date().toLocaleString(lang === "ar" ? "ar" : "en", { month: "long", year: "numeric" })} · ${t("dashboardSubtitle")}`}
      />

      {roles.isOwner && <MonthEndCards />}
      {roles.isOwner && <EInvoiceWarning />}
      {roles.isOwner && <BudgetStatus />}
      <WorkOverview />

      {lowStock.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-warning" />
          <span className="font-medium">
            {lowStock.length === 1 
              ? tt("1 product is at or below the reorder threshold")
              : tt("{count} products are at or below the reorder threshold").replace("{count}", String(lowStock.length))}
          </span>
          <span className="text-muted-foreground">
            {lowStock
              .slice(0, 4)
              .map((p) => `${p.name} (${p.stock_qty})`)
              .join(", ")}
          </span>
          <Link to="/inventory" className="ms-auto text-sm font-medium text-primary underline">
            {tt("Open inventory")}
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.isOwner && <StatCard label={tt("Revenue")} value={money(cur.revenue)} previous={pct(cur.revenue, prev.revenue)} />}
        {roles.isOwner && (
          <StatCard label={tt("Net profit")} value={money(cur.profit)} previous={pct(cur.profit, prev.profit)}
            hint={cur.unallocated ? `${t("dash_unallocated")}: ${money(cur.unallocated)}` : undefined} />
        )}
        {roles.isOwner && (
          <StatCard label={t("dash_sharedCosts")} value={money(cur.shared)} previous={pct(cur.shared, prev.shared)} invertColor />
        )}
        {roles.isOwner && <StatCard label={tt("Orders")} value={String(cur.orders)} previous={pct(cur.orders, prev.orders)} />}
        <StatCard label={tt("Stock value")} value={money(stockValue)} hint={tt("At weighted average cost")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-4">
          <h2 className="mb-4 font-display text-lg">{tt("Revenue \u00b7 last 6 months")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} tickFormatter={(v) => compactMoney(v)} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Area
                  type="monotone"
                  dataKey="revenue" name={t("revenue")}
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-4">
          <h2 className="mb-4 font-display text-lg">{t("dash_top5Profit")}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitByProduct} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => compactMoney(v)} />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar name={t("profit")} dataKey="profit" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-display text-lg">{tt("Recent orders")}</h2>
          <Link to="/orders" className="text-sm text-primary underline">
            {tt("All orders")}
          </Link>
        </div>
        <table className="w-full min-w-[540px] text-sm">
          <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{tt("Date")}</th>
              <th className="px-4 py-3">{tt("Platform")}</th>
              <th className="px-4 py-3">{tt("Customer")}</th>
              <th className="px-4 py-3">{tt("Value")}</th>
              <th className="px-4 py-3">{tt("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 10).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3">{formatDate(o.order_date)}</td>
                <td className="px-4 py-3">{tt(o.platform)}</td>
                <td className="px-4 py-3">{o.customer_name ?? "—"}</td>
                <td className="px-4 py-3">
                  {money(o.order_items.reduce((s, i) => s + Number(i.quantity) * Number(i.sale_price), 0))}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={o.status === "completed" ? "default" : "secondary"}>
                    {ts(o.status)}
                  </Badge>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {tt("No orders yet \u2014 add one from the Orders page.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
