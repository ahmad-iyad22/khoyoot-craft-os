import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
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

function monthLabel(d: Date) {
  return d.toLocaleString("en", { month: "short" });
}

function Dashboard() {
  const roles = useRoles();
  const { t, lang } = useI18n();
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

  const expensesQ = useQuery({
    queryKey: ["dash-expenses", sinceIso],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("entry_date, category, amount")
        .gte("entry_date", sinceIso);
      if (error) throw error;
      return data ?? [];
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
  const expenses = expensesQ.data ?? [];

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });

  const inMonth = (dateStr: string, d: Date) => {
    const t = new Date(dateStr);
    return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
  };

  const monthly = months.map((d) => {
    const monthOrders = orders.filter((o) => inMonth(o.order_date, d) && o.status !== "cancelled");
    const revenue = monthOrders.reduce(
      (s, o) => s + o.order_items.reduce((x, i) => x + Number(i.quantity) * Number(i.sale_price), 0),
      0,
    );
    const cogs = monthOrders.reduce(
      (s, o) => s + o.order_items.reduce((x, i) => x + Number(i.quantity) * Number(i.unit_cost), 0),
      0,
    );
    const monthExp = expenses.filter((e) => inMonth(e.entry_date, d));
    const expenseTotal = monthExp.reduce((s, e) => s + Number(e.amount), 0);
    const adSpend = monthExp.filter((e) => e.category === "ads").reduce((s, e) => s + Number(e.amount), 0);
    return {
      label: monthLabel(d),
      revenue,
      cogs,
      expenseTotal,
      adSpend,
      orders: monthOrders.length,
      profit: revenue - cogs - expenseTotal,
    };
  });

  const emptyMonth = { label: "", revenue: 0, cogs: 0, expenseTotal: 0, adSpend: 0, orders: 0, profit: 0 };
  const cur = monthly[monthly.length - 1] ?? emptyMonth;
  const prev = monthly[monthly.length - 2] ?? emptyMonth;
  const stockValue = products.reduce((s, p) => s + Number(p.stock_qty) * Number(p.avg_cost), 0);
  const lowStock = products.filter((p) => Number(p.stock_qty) <= Number(p.reorder_threshold));

  const profitByProduct = (() => {
    const map = new Map<string, number>();
    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) =>
        o.order_items.forEach((i) => {
          if (!i.product_id) return;
          const margin = Number(i.quantity) * (Number(i.sale_price) - Number(i.unit_cost));
          map.set(i.product_id, (map.get(i.product_id) ?? 0) + margin);
        }),
      );
    return [...map.entries()]
      .map(([id, profit]) => ({
        name: products.find((p) => p.id === id)?.name ?? "Unknown",
        profit: Math.round(profit),
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  })();

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
          description="Which products and platforms sell — costs and financial records stay with the Owner."
        />
        <div className="card-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
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
                    No sales recorded yet.
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

      {lowStock.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-warning" />
          <span className="font-medium">
            {lowStock.length} product{lowStock.length > 1 ? "s are" : " is"} at or below the reorder
            threshold
          </span>
          <span className="text-muted-foreground">
            {lowStock
              .slice(0, 4)
              .map((p) => `${p.name} (${p.stock_qty})`)
              .join(", ")}
          </span>
          <Link to="/inventory" className="ml-auto text-sm font-medium text-primary underline">
            Open inventory
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Revenue" value={money(cur.revenue)} previous={pct(cur.revenue, prev.revenue)} />
        {roles.isOwner && (
          <StatCard
            label="Total expenses"
            value={money(cur.expenseTotal)}
            previous={pct(cur.expenseTotal, prev.expenseTotal)}
            invertColor
          />
        )}
        {roles.isOwner && (
          <StatCard label="Net profit" value={money(cur.profit)} previous={pct(cur.profit, prev.profit)} />
        )}
        <StatCard label="Orders" value={String(cur.orders)} previous={pct(cur.orders, prev.orders)} />
        <StatCard label="Stock value" value={money(stockValue)} hint="At weighted average cost" />
        {roles.isOwner && (
          <StatCard label="Ad spend" value={money(cur.adSpend)} previous={pct(cur.adSpend, prev.adSpend)} invertColor />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-4">
          <h2 className="mb-4 font-display text-lg">Revenue · last 6 months</h2>
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
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-4">
          <h2 className="mb-4 font-display text-lg">Top 5 products by margin</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitByProduct} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => compactMoney(v)} />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="profit" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-display text-lg">Recent orders</h2>
          <Link to="/orders" className="text-sm text-primary underline">
            All orders
          </Link>
        </div>
        <table className="w-full min-w-[540px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 10).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3">{formatDate(o.order_date)}</td>
                <td className="px-4 py-3">{o.platform}</td>
                <td className="px-4 py-3">{o.customer_name ?? "—"}</td>
                <td className="px-4 py-3">
                  {money(o.order_items.reduce((s, i) => s + Number(i.quantity) * Number(i.sale_price), 0))}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={o.status === "completed" ? "default" : "secondary"}>
                    {titleCase(o.status)}
                  </Badge>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No orders yet — add one from the Orders page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
