import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { money, pct } from "@/lib/format";
import { marginState } from "@/lib/margin";
import { currentMonth, useBalances, useStatement } from "@/lib/month-end";
import { usePendingCount } from "@/components/approvals";

const monthStart = (offset: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

/** Owner-only "Today" overview: cash, this month vs last, 30-day platform sales and alerts. */
export function TodaySection() {
  const { t } = useI18n();
  const bal = useBalances().data ?? [];
  const sum = (f: (b: any) => boolean, k: string) => bal.filter(f).reduce((s, b) => s + Number(b[k] ?? 0), 0);
  const summary = useQuery({
    queryKey: ["today-summary", monthStart(0)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_summary" as never, { _month: monthStart(0) } as never);
      if (error) throw error;
      return (data as unknown as { months: any[] }).months ?? [];
    },
  });
  const months = summary.data ?? [];
  const cur = months[months.length - 1] ?? {}; const prev = months[months.length - 2] ?? {};
  const platforms = useQuery({
    queryKey: ["today-platforms"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const [s, o] = await Promise.all([
        supabase.from("app_settings").select("counting_statuses").eq("id", true).maybeSingle(),
        supabase.from("orders").select("platform, status, order_items(quantity, sale_price)").gte("order_date", since),
      ]);
      if (o.error) throw o.error;
      const counted = new Set<string>((s.data?.counting_statuses as string[] | undefined) ?? []);
      const map = new Map<string, { platform: string; orders: number; revenue: number }>();
      for (const r of (o.data ?? []) as any[]) {
        if (!counted.has(r.status)) continue;
        const e = map.get(r.platform) ?? { platform: r.platform, orders: 0, revenue: 0 };
        e.orders += 1; e.revenue += (r.order_items ?? []).reduce((a: number, i: any) => a + Number(i.quantity) * Number(i.sale_price), 0);
        map.set(r.platform, e);
      }
      return [...map.values()].sort((a, b) => b.revenue - a.revenue);
    },
  });
  const alerts = useQuery({
    queryKey: ["today-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("stock_qty, reorder_threshold, min_stock, sale_price, avg_cost, target_margin, margin_alert_threshold, status").eq("archived", false);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return {
        low: rows.filter((r) => ["active", "out_of_stock"].includes(r.status) && Number(r.stock_qty) <= Math.max(Number(r.min_stock ?? 0), Number(r.reorder_threshold ?? 0))).length,
        margin: rows.filter((r) => Number(r.avg_cost) > 0 && marginState(r).level === "alert").length,
      };
    },
  });
  const pending = usePendingCount().data ?? 0;
  const last = useStatement(monthStart(-1));
  const readyToClose = !!last.data && !last.data.closed;
  const thisMonth = useStatement(currentMonth());

  const box = "card-surface block p-4 transition-colors hover:border-primary/50";
  const alertItems = [
    { label: t("today_low"), n: alerts.data?.low ?? 0, to: "/inventory" },
    { label: t("today_margin"), n: alerts.data?.margin ?? 0, to: "/inventory" },
    { label: t("today_pending"), n: pending, to: "/approvals" },
    { label: t("today_close"), n: readyToClose ? 1 : 0, to: "/month-end" },
  ];
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3"><div className="tatreez-band h-1.5 w-10 rounded-full" /><h2 className="font-display text-xl">{t("today_title")}</h2></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/bank" className={box}><p className="text-xs text-muted-foreground">{t("bk_businessBalance")}</p><p className="font-display text-2xl">{money(sum((b) => b.kind === "business_bank", "balance_base"))}</p><p className="mt-1 text-xs text-muted-foreground">{t("bk_pendingTotal")}: {money(sum((b) => b.kind === "platform_wallet", "pending_payout"))}</p></Link>
        <Link to="/month-end" className={box}><p className="text-xs text-muted-foreground">{t("today_sales")}</p><p className="font-display text-2xl">{money(Number(cur.revenue ?? 0))}</p><p className="mt-1 text-xs text-muted-foreground">{t("today_prev")}: {money(Number(prev.revenue ?? 0))} · {pct(Number(cur.revenue ?? 0), Number(prev.revenue ?? 0))}</p></Link>
        <Link to="/month-end" className={box}><p className="text-xs text-muted-foreground">{t("today_profit")}</p><p className="font-display text-2xl">{money(Number(cur.net_profit ?? 0))}</p><p className="mt-1 text-xs text-muted-foreground">{t("today_prev")}: {money(Number(prev.net_profit ?? 0))} · {pct(Number(cur.net_profit ?? 0), Number(prev.net_profit ?? 0))}</p></Link>
        <Link to="/month-end" className={box}><p className="text-xs text-muted-foreground">{t("today_status")}</p><p className="font-display text-2xl">{thisMonth.data?.closed ? t("me_closed") : t("me_live")}</p><p className="mt-1 text-xs text-muted-foreground">{t("me_seeDetails")}</p></Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between"><p className="font-display text-lg">{t("today_platforms")}</p><Link to="/orders" className="text-xs font-medium text-primary underline">{t("orders")}</Link></div>
          {(platforms.data ?? []).length ? <>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={platforms.data}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="platform" fontSize={12} /><YAxis fontSize={12} width={48} /><Tooltip formatter={(v: number) => money(v)} /><Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div className="mt-2 grid gap-1 text-sm">{platforms.data!.map((p) => <Link key={p.platform} to="/orders" className="flex justify-between hover:text-primary"><span>{p.platform}</span><span className="tabular-nums">{p.orders} · {money(p.revenue)}</span></Link>)}</div>
          </> : <p className="text-sm text-muted-foreground">{t("today_noSales")}</p>}
        </div>
        <div className="card-surface space-y-2 p-4">
          <p className="font-display text-lg">{t("today_alerts")}</p>
          {alertItems.map((a) => <Link key={a.label} to={a.to} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/50"><span>{a.label}</span><span className={a.n ? "font-semibold text-destructive" : "text-muted-foreground"}>{a.n}</span></Link>)}
        </div>
      </div>
    </section>
  );
}
