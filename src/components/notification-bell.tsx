import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useRoles } from "@/lib/auth";
import { marginState } from "@/lib/margin";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Alert = { id: string; text: string; to: string };
// Alerts are computed live; keys embed the triggering values so a read alert
// reappears only when its condition changes. Read marks live per user in notification_reads.
export function NotificationBell() {
  const { lang } = useI18n();
  const roles = useRoles();
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const qc = useQueryClient();
  const readQ = useQuery({
    queryKey: ["notification-reads"],
    enabled: roles.isOwner,
    queryFn: async () => ((await supabase.from("notification_reads").select("alert_key")).data ?? []).map((r) => r.alert_key),
  });
  const read = readQ.data ?? [];
  const persist = async (keys: string[]) => {
    if (!keys.length) return;
    await supabase.from("notification_reads").upsert(keys.map((alert_key) => ({ alert_key })), { onConflict: "user_id,alert_key" });
    qc.invalidateQueries({ queryKey: ["notification-reads"] });
  };

  const q = useQuery({
    queryKey: ["notifications"],
    enabled: roles.isOwner,
    refetchInterval: 120000,
    queryFn: async () => {
      const out: Alert[] = [];
      const [p, s] = await Promise.all([
        supabase.from("products").select("id, name, stock_qty, reorder_threshold, min_stock, sale_price, avg_cost, target_margin, margin_alert_threshold, status").eq("archived", false),
        supabase.from("shipments").select("id, reference, status, updated_at").eq("status", "arrived_in_malaysia"),
      ]);
      for (const r of p.data ?? []) {
        if (["active", "out_of_stock"].includes(r.status) && Number(r.stock_qty) <= Math.max(Number(r.min_stock ?? 0), Number(r.reorder_threshold ?? 0)))
          out.push({ id: `low-${r.id}-${r.stock_qty}`, text: L(`Low stock: ${r.name} (${r.stock_qty})`, `مخزون منخفض: ${r.name} (${r.stock_qty})`), to: "/inventory" });
        if (roles.isOwner && Number(r.avg_cost) > 0 && marginState(r).level === "alert")
          out.push({ id: `mar-${r.id}-${r.avg_cost}-${r.sale_price}`, text: L(`Margin below alert: ${r.name}`, `الهامش أقل من الحد: ${r.name}`), to: "/inventory" });
      }
      for (const r of s.data ?? [])
        out.push({ id: `ship-${r.id}`, text: L(`Shipment arrived: ${r.reference} — add to inventory`, `وصلت الشحنة: ${r.reference} — أضفها للمخزون`), to: "/shipments" });
      if (roles.isOwner) {
        const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        const { data: docs } = await supabase.from("company_documents").select("id, title, expires_on").not("expires_on", "is", null).lte("expires_on", soon);
        for (const r of docs ?? [])
          out.push({ id: `doc-${r.id}-${r.expires_on}`, text: L(`Document expiring ${r.expires_on}: ${r.title}`, `مستند ينتهي ${r.expires_on}: ${r.title}`), to: "/documents" });
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
        const m = d.toISOString().slice(0, 8) + "01";
        const { data } = await supabase.from("month_closures").select("id").eq("month", m).maybeSingle();
        if (!data) out.push({ id: `month-${m}`, text: L(`Month ${m.slice(0, 7)} is ready to close`, `شهر ${m.slice(0, 7)} جاهز للإغلاق`), to: "/month-end" });
        const [pe, pt] = await Promise.all([
          supabase.from("expenses").select("id").eq("approval_status", "pending"),
          supabase.from("partner_transactions").select("id").eq("approval_status", "pending"),
        ]);
        for (const r of [...(pe.data ?? []), ...(pt.data ?? [])])
          out.push({ id: `appr-${r.id}`, text: L("Expense waiting for your approval", "مصروف بانتظار موافقتك"), to: "/approvals" });
        const cm = new Date().toISOString().slice(0, 8) + "01";
        const { data: bs } = await supabase.rpc("category_budget_status", { _month: cm });
        for (const b of ((bs ?? []) as any[]).filter((b) => b.state === "warn" || b.state === "over"))
          out.push({ id: `bud-${cm}-${b.category}-${b.state}`, text: b.state === "over" ? L(`Over budget: ${b.category} (${b.percent}%)`, `تجاوز الميزانية: ${b.category} (${b.percent}%)`) : L(`Budget near limit: ${b.category} (${b.percent}%)`, `الميزانية تقترب من الحد: ${b.category} (${b.percent}%)`), to: "/shared-expenses" });
      }
      return out;
    },
  });

  const alerts = q.data ?? [];
  const unread = alerts.filter((a) => !read.includes(a.id));
  if (!roles.isOwner) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="relative flex w-full items-center gap-2 rounded-lg bg-sidebar-accent/40 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <Bell className="size-4" /> {L("Notifications", "الإشعارات")}
          {unread.length > 0 && <span className="ms-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
          {L("Notifications", "الإشعارات")}
          {unread.length > 0 && (
            <button className="text-xs text-primary" onClick={() => persist(unread.map((a) => a.id))}>{L("Mark all read", "تعليم الكل كمقروء")}</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">{L("No alerts", "لا توجد تنبيهات")}</p>}
          {alerts.map((a) => {
            const isRead = read.includes(a.id);
            return (
              <div key={a.id} className={`flex items-start gap-2 border-b px-3 py-2 text-sm ${isRead ? "opacity-50" : ""}`}>
                <Link to={a.to} className="flex-1 hover:underline">{a.text}</Link>
                {!isRead && (
                  <button aria-label={L("Mark read", "تعليم كمقروء")} onClick={() => persist([a.id])} className="text-muted-foreground hover:text-foreground"><Check className="size-4" /></button>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
