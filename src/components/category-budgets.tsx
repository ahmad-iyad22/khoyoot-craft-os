import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryLabel, fmtMoney, useAppSettings, useExpenseCategories } from "@/lib/money";

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const useL = () => { const { lang } = useI18n(); return { lang, L: (en: string, ar: string) => (lang === "ar" ? ar : en) }; };

/** Spent vs budget per expense category for a month ("YYYY-MM"). Informational only. */
export function BudgetStatus({ month }: { month?: string }) {
  const { L, lang } = useL();
  const cats = useExpenseCategories();
  const base = useAppSettings().data?.base_currency ?? "";
  const m = (month || new Date().toISOString().slice(0, 7)) + "-01";
  const q = useQuery({ queryKey: ["budget-status", m], queryFn: async () => {
    const { data, error } = await supabase.rpc("category_budget_status", { _month: m });
    if (error) throw error; return (data ?? []) as any[];
  } });
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="font-display text-lg">{L("Monthly budgets", "الميزانيات الشهرية")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const pctv = Math.min(100, Number(r.percent ?? 0));
          const tone = r.state === "over" ? "bg-destructive" : r.state === "warn" ? "bg-warning" : "bg-success";
          return (
            <div key={r.category} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1 font-medium">
                  {r.state !== "ok" && <AlertTriangle className={`size-4 ${r.state === "over" ? "text-destructive" : "text-warning"}`} />}
                  {categoryLabel(cats.data, r.category, lang)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {fmtMoney(r.spent, base)} / {fmtMoney(r.budget, base)} · {L("Remaining", "المتبقي")} {fmtMoney(r.remaining, base)} · {r.percent ?? 0}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${tone}`} style={{ width: `${pctv}%` }} /></div>
              {r.state === "over" && <p className="text-xs text-destructive">{L("Over budget", "تجاوز الميزانية")}</p>}
              {r.state === "warn" && <p className="text-xs text-warning-foreground">{L(`Reached ${r.warn_at_percent}% warning level`, `بلغ حد التنبيه ${r.warn_at_percent}%`)}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Owner editor for category budgets (Settings). */
export function BudgetSettings({ canEdit }: { canEdit: boolean }) {
  const { L, lang } = useL();
  const qc = useQueryClient();
  const cats = useExpenseCategories();
  const base = useAppSettings().data?.base_currency ?? "";
  const [form, setForm] = useState<any>(null);
  const [del, setDel] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["category-budgets"], queryFn: async () => {
    const { data, error } = await supabase.from("category_budgets").select("*").order("category_code");
    if (error) throw error; return data ?? [];
  } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["category-budgets"] }); void qc.invalidateQueries({ queryKey: ["budget-status"] }); };
  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount), warn = Number(form.warn_at_percent);
      if (!form.category_code) throw new Error(L("Choose a category", "اختر فئة"));
      if (!(amount >= 0) || form.amount === "") throw new Error(L("Enter an amount", "أدخل مبلغاً"));
      if (!(warn > 0)) throw new Error(L("Warning % must be above 0", "يجب أن تكون نسبة التنبيه أكبر من 0"));
      const payload = { category_code: form.category_code, month: form.month ? form.month + "-01" : null, amount, warn_at_percent: warn };
      const { error } = form.id ? await supabase.from("category_budgets").update(payload).eq("id", form.id) : await supabase.from("category_budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(L("Saved", "تم الحفظ")); setForm(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("category_budgets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(L("Deleted", "تم الحذف")); setDel(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="font-display text-lg">{L("Monthly budgets", "الميزانيات الشهرية")}</CardTitle>
        {canEdit && <Button size="sm" onClick={() => setForm({ category_code: "", month: "", amount: "", warn_at_percent: "80" })}><Plus className="size-4" />{L("Add budget", "إضافة ميزانية")}</Button>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <p className="mb-2 text-xs text-muted-foreground">{L("Warnings are informational only; saving expenses is never blocked.", "التنبيهات للمعلومة فقط؛ لا يُمنع حفظ أي مصروف.")}</p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{L("Category", "الفئة")}</TableHead><TableHead>{L("Month", "الشهر")}</TableHead>
            <TableHead>{L("Budget", "الميزانية")}</TableHead><TableHead>{L("Warn at", "التنبيه عند")}</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>{categoryLabel(cats.data, b.category_code, lang)}</TableCell>
                <TableCell>{b.month ? b.month.slice(0, 7) : L("Every month", "كل شهر")}</TableCell>
                <TableCell className="tabular-nums">{fmtMoney(b.amount, base)}</TableCell>
                <TableCell>{b.warn_at_percent}%</TableCell>
                <TableCell className="text-end">{canEdit && <>
                  <Button size="icon" variant="ghost" aria-label={L("Edit", "تعديل")} onClick={() => setForm({ id: b.id, category_code: b.category_code, month: b.month ? b.month.slice(0, 7) : "", amount: String(b.amount), warn_at_percent: String(b.warn_at_percent) })}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={L("Delete", "حذف")} onClick={() => setDel(b.id)}><Trash2 className="size-4" /></Button>
                </>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? L("Edit budget", "تعديل الميزانية") : L("Add budget", "إضافة ميزانية")}</DialogTitle></DialogHeader>
          {form && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>{L("Category", "الفئة")}</Label>
              <select className={sel} value={form.category_code} onChange={(e) => setForm({ ...form, category_code: e.target.value })}>
                <option value="">—</option>
                {(cats.data ?? []).map((c) => <option key={c.code} value={c.code}>{categoryLabel(cats.data, c.code, lang)}</option>)}
              </select></div>
            <div className="space-y-1 sm:col-span-2"><Label>{L("Month (empty = every month)", "الشهر (فارغ = كل شهر)")}</Label>
              <Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></div>
            <div className="space-y-1"><Label>{L("Amount", "المبلغ")} ({base})</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1"><Label>{L("Warn at %", "التنبيه عند %")}</Label><Input type="number" min="1" value={form.warn_at_percent} onChange={(e) => setForm({ ...form, warn_at_percent: e.target.value })} /></div>
          </div>}
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{L("Save", "حفظ")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDelete open={!!del} onOpenChange={(v) => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />
    </Card>
  );
}
