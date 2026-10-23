import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Yearly sales vs an Owner-entered e-invoicing limit. Informational only.
export function EInvoiceWarning() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const qc = useQueryClient();
  const year = new Date().getFullYear();

  const setQ = useQuery({
    queryKey: ["app-settings-einv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("list_options").eq("id", true).maybeSingle();
      if (error) throw error;
      return (data?.list_options ?? {}) as Record<string, any>;
    },
  });
  const salesQ = useQuery({
    queryKey: ["einv-year-sales", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status, order_items(quantity, sale_price)")
        .gte("order_date", `${year}-01-01`)
        .lte("order_date", `${year}-12-31`);
      if (error) throw error;
      return (data ?? [])
        .filter((o: any) => o.status !== "cancelled")
        .reduce((s: number, o: any) => s + (o.order_items ?? []).reduce((a: number, i: any) => a + Number(i.quantity) * Number(i.sale_price), 0), 0);
    },
  });

  const threshold = Number(setQ.data?.["einvoice_threshold"] ?? 0);
  const warnPct = Number(setQ.data?.["einvoice_warn_pct"] ?? 80);
  const [edit, setEdit] = useState(false);
  const [tv, setTv] = useState("");
  const [wv, setWv] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const next = { ...(setQ.data ?? {}), einvoice_threshold: Number(tv) || 0, einvoice_warn_pct: Number(wv) || 80 };
      const { error } = await supabase.from("app_settings").update({ list_options: next }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(L("Saved", "تم الحفظ")); setEdit(false); qc.invalidateQueries({ queryKey: ["app-settings-einv"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sales = salesQ.data ?? 0;
  const pct = threshold > 0 ? Math.min(100, (sales / threshold) * 100) : 0;
  const level = threshold <= 0 ? "none" : pct >= 100 ? "over" : pct >= warnPct ? "near" : "ok";
  const fmt = (n: number) => `RM ${n.toLocaleString(ar ? "ar" : "en", { maximumFractionDigits: 0 })}`;

  return (
    <div className={`card-surface p-4 space-y-3 ${level === "over" || level === "near" ? "border-destructive/60 border-2" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{L(`E-invoice check · ${year}`, `فحص الفاتورة الإلكترونية · ${year}`)}</h3>
        <Button size="sm" variant="outline" onClick={() => { setTv(String(threshold || "")); setWv(String(warnPct)); setEdit(!edit); }}>
          {L("Set limit", "تحديد الحد")}
        </Button>
      </div>
      {edit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">{L("Yearly limit (RM)", "الحد السنوي (رنجت)")}
            <Input type="number" value={tv} onChange={(e) => setTv(e.target.value)} className="w-40" />
          </label>
          <label className="text-xs">{L("Warn at %", "التنبيه عند %")}
            <Input type="number" value={wv} onChange={(e) => setWv(e.target.value)} className="w-24" />
          </label>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{L("Save", "حفظ")}</Button>
        </div>
      )}
      {threshold <= 0 ? (
        <p className="text-sm text-muted-foreground">{L("No limit set yet. Ask your accountant for the exact e-invoicing limit and enter it here.", "لم يُحدد حد بعد. اسأل المحاسب عن الحد الدقيق للفوترة الإلكترونية وأدخله هنا.")}</p>
      ) : (
        <>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div className={`h-full ${level === "ok" ? "bg-secondary" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm">{L(`Sales this year ${fmt(sales)} of ${fmt(threshold)} (${pct.toFixed(0)}%)`, `مبيعات هذه السنة ${fmt(sales)} من ${fmt(threshold)} (${pct.toFixed(0)}%)`)}</p>
          {level !== "ok" && (
            <p className="text-sm font-medium text-destructive">
              {level === "over"
                ? L("You have passed the limit — talk to your accountant about e-invoicing now.", "تجاوزتم الحد — تحدثوا مع المحاسب عن الفوترة الإلكترونية الآن.")
                : L("You are getting close to the limit — talk to your accountant about e-invoicing.", "اقتربتم من الحد — تحدثوا مع المحاسب عن الفوترة الإلكترونية.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
