import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezEmptyState } from "@/components/tatreez";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload, openReceipt } from "@/components/receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { MoneyFields, categoryLabel, fmtMoney, readMoney, useAppSettings, useExpenseCategories } from "@/lib/money";
import { inMonth, monthOptions } from "@/lib/ledger";

export const Route = createFileRoute("/_authenticated/shared-expenses")({
  head: () => ({
    meta: [
      { title: "Shared expenses — Khoyoot" },
      { name: "description", content: "Shared business expenses, who paid, and how each one is split between partners." },
      { property: "og:title", content: "Shared expenses — Khoyoot" },
      { property: "og:description", content: "Shared business expenses, who paid, and how each one is split between partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedExpensesPage,
});

type SplitMode = "equal" | "percent" | "amount";

function SharedExpensesPage() {
  const roles = useRoles();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const baseCur = useAppSettings().data?.base_currency ?? "MYR";
  const catsQ = useExpenseCategories();
  const [month, setMonth] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);

  const partnersQ = useQuery({
    queryKey: ["partners-basic"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, name, active").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const expensesQ = useQuery({
    queryKey: ["shared-expenses"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_splits(*), campaigns(name), shipments(reference)")
        .eq("is_shared", true)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const linksQ = useQuery({
    queryKey: ["expense-links"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const [c, s] = await Promise.all([
        supabase.from("campaigns").select("id, name").order("created_at", { ascending: false }),
        supabase.from("shipments").select("id, reference").order("created_at", { ascending: false }),
      ]);
      return { campaigns: c.data ?? [], shipments: s.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (v: { id: string | null; e: Record<string, unknown>; splits: { partner_id: string; percent: number }[] }) => {
      const { error } = await supabase.rpc("save_shared_expense", { _id: v.id, _e: v.e, _splits: v.splits } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["shared-expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("SPLIT_NOT_100") ? t("splitMust100") : e.message.includes("PAYER_REQUIRED") ? t("payerRequired") : e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries({ queryKey: ["shared-expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isOwner) return <AccessDenied message={t("partnersOwnerOnly")} />;

  const partners = (partnersQ.data ?? []) as any[];
  const nameOf = (id: string | null) => partners.find((p) => p.id === id)?.name ?? "—";
  const rows = ((expensesQ.data ?? []) as any[]).filter((e) => inMonth(e.entry_date, month));
  const monthLabel = (m: string) =>
    new Date(m + "-01T00:00:00").toLocaleDateString(lang === "ar" ? "ar" : "en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title={t("sharedExpenses")}
        description={t("sharedExpensesSubtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCatsOpen(true)}>
              <Tags className="size-4" /> {t("expenseCategories")}
            </Button>
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> {t("addExpense")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 space-y-2">
        <Label htmlFor="se-month">{t("month")}</Label>
        <select id="se-month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">{t("allTime")}</option>
          {monthOptions().map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("paidBy")}</TableHead>
                <TableHead>{t("split")}</TableHead>
                <TableHead className="text-end">{t("amount")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(e.entry_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{categoryLabel(catsQ.data, e.category, lang)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <p className="truncate" dir="auto">{e.description ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.campaigns?.name && `${t("campaign")}: ${e.campaigns.name}`}
                      {e.shipments?.reference && `${t("shipment")}: ${e.shipments.reference}`}
                    </p>
                  </TableCell>
                  <TableCell>{e.paid_by_business ? t("businessAccount") : nameOf(e.paid_by_partner_id)}</TableCell>
                  <TableCell className="text-xs">
                    {(e.expense_splits ?? []).map((s: any) => (
                      <div key={s.id}>
                        {nameOf(s.partner_id)} · {Number(s.share_percent)}% · {fmtMoney(s.share_amount, baseCur)}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <div>{fmtMoney(e.amount, e.currency ?? baseCur)}</div>
                    {e.currency && e.currency !== baseCur && <div className="text-xs text-muted-foreground">{fmtMoney(e.base_amount, baseCur)}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-end">
                    {e.receipt_path ? (
                      <Button variant="ghost" size="icon" className="size-8" aria-label={t("viewReceipt")} onClick={() => openReceipt(e.receipt_path)}>
                        <Paperclip className="size-4" />
                      </Button>
                    ) : (
                      <Badge variant="outline" className="me-1 text-[10px] text-muted-foreground">{t("noReceipt")}</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="size-8" aria-label={t("edit")} onClick={() => setEditing(e)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={t("delete")} onClick={() => setToDelete(e.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <TatreezEmptyState title={t("noSharedExpenses")} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("editExpense") : t("addExpense")}</DialogTitle>
            <DialogDescription>{t("sharedExpenseHint")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <ExpenseForm
              key={editing.id ?? "new"}
              row={editing}
              partners={partners.filter((p) => p.active !== false)}
              categories={catsQ.data ?? []}
              links={linksQ.data ?? { campaigns: [], shipments: [] }}
              pending={save.isPending}
              onSubmit={(e, splits) => save.mutate({ id: editing.id ?? null, e, splits })}
            />
          )}
        </DialogContent>
      </Dialog>

      <CategoriesDialog open={catsOpen} onOpenChange={setCatsOpen} />

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function ExpenseForm({
  row,
  partners,
  categories,
  links,
  pending,
  onSubmit,
}: {
  row: any;
  partners: any[];
  categories: any[];
  links: { campaigns: any[]; shipments: any[] };
  pending: boolean;
  onSubmit: (e: Record<string, unknown>, splits: { partner_id: string; percent: number }[]) => void;
}) {
  const { t, lang } = useI18n();
  const existing: any[] = row.expense_splits ?? [];
  const [mode, setMode] = useState<SplitMode>((row.split_mode as SplitMode) ?? "equal");
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(partners.map((p) => [p.id, existing.length ? existing.some((s) => s.partner_id === p.id) : true])),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(partners.map((p) => [p.id, String(existing.find((s) => s.partner_id === p.id)?.share_percent ?? "")])),
  );
  const active = partners.filter((p) => included[p.id]);
  const total = active.reduce((s, p) => s + Number(values[p.id] || 0), 0);

  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const m = readMoney(f);
        if (m.amount <= 0) return void toast.error(t("amountPositive"));
        if (!active.length) return void toast.error(t("splitMust100"));
        let splits: { partner_id: string; percent: number }[];
        if (mode === "equal") {
          const each = Math.floor((10000 / active.length)) / 100;
          splits = active.map((p, i) => ({ partner_id: p.id, percent: i === active.length - 1 ? Math.round((100 - each * (active.length - 1)) * 100) / 100 : each }));
        } else if (mode === "percent") {
          if (Math.abs(total - 100) > 0.01) return void toast.error(t("splitMust100"));
          splits = active.map((p) => ({ partner_id: p.id, percent: Number(values[p.id] || 0) }));
        } else {
          if (Math.abs(total - m.amount) > 0.01) return void toast.error(t("splitMustAmount"));
          splits = active.map((p) => ({ partner_id: p.id, percent: Math.round((Number(values[p.id] || 0) / m.amount) * 1e6) / 1e4 }));
          const diff = Math.round((100 - splits.reduce((s, x) => s + x.percent, 0)) * 1e4) / 1e4;
          if (splits.length) splits[splits.length - 1]!.percent = Math.round((splits[splits.length - 1]!.percent + diff) * 1e4) / 1e4;
        }
        const payer = String(f.get("payer") || "");
        onSubmit(
          {
            entry_date: String(f.get("entry_date")),
            category: String(f.get("category")),
            description: String(f.get("description") || "").trim(),
            paid_by_business: payer === "business",
            paid_by_partner_id: payer && payer !== "business" ? payer : null,
            split_mode: mode,
            campaign_id: String(f.get("campaign_id") || "") || null,
            shipment_id: String(f.get("shipment_id") || "") || null,
            receipt_path: String(f.get("receipt_path") || "") || null,
            ...m,
          },
          splits,
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="se-date">{t("date")}</Label>
          <Input id="se-date" name="entry_date" type="date" required defaultValue={row.entry_date ?? new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-cat">{t("category")}</Label>
          <select id="se-cat" name="category" required defaultValue={row.category ?? categories[0]?.code} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {categories.map((c) => (
              <option key={c.code} value={c.code}>{lang === "ar" ? c.label_ar || c.label : c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="se-desc">{t("description")}</Label>
        <Textarea id="se-desc" name="description" rows={2} defaultValue={row.description ?? ""} dir="auto" />
      </div>
      <MoneyFields idPrefix="se" defaultAmount={row.amount} defaultCurrency={row.currency} defaultFx={row.fx_rate_to_base} />
      <div className="space-y-2">
        <Label htmlFor="se-payer">{t("paidBy")}</Label>
        <select
          id="se-payer"
          name="payer"
          required
          defaultValue={row.paid_by_business ? "business" : (row.paid_by_partner_id ?? "")}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>{t("choosePayer")}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="business">{t("businessAccount")}</option>
        </select>
      </div>

      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">{t("split")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["equal", "percent", "amount"] as SplitMode[]).map((m) => (
            <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
              {t(`split_${m}`)}
            </Button>
          ))}
        </div>
        {partners.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input type="checkbox" checked={!!included[p.id]} onChange={(e) => setIncluded((s) => ({ ...s, [p.id]: e.target.checked }))} />
              {p.name}
            </label>
            {mode !== "equal" && included[p.id] && (
              <Input
                className="w-28"
                type="number"
                step="0.01"
                min="0"
                aria-label={p.name}
                value={values[p.id] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, [p.id]: e.target.value }))}
              />
            )}
            {mode === "equal" && included[p.id] && (
              <span className="text-sm text-muted-foreground tabular-nums">{active.length ? (100 / active.length).toFixed(2) : 0}%</span>
            )}
          </div>
        ))}
        {mode !== "equal" && (
          <p className="text-xs text-muted-foreground">
            {t("total")}: {total.toFixed(2)} {mode === "percent" ? "%" : ""}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="se-camp">{t("linkCampaign")}</Label>
          <select id="se-camp" name="campaign_id" defaultValue={row.campaign_id ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">—</option>
            {links.campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="se-ship">{t("linkShipment")}</Label>
          <select id="se-ship" name="shipment_id" defaultValue={row.shipment_id ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">—</option>
            {links.shipments.map((s: any) => (
              <option key={s.id} value={s.id}>{s.reference}</option>
            ))}
          </select>
        </div>
      </div>
      <ReceiptUpload idPrefix="se" defaultPath={row.receipt_path} />
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t("save")}</Button>
      </DialogFooter>
    </form>
  );
}

function CategoriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const catsQ = useExpenseCategories();
  const [toDelete, setToDelete] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["expense-categories"] });
  const upsert = useMutation({
    mutationFn: async (v: { id?: string; label: string; label_ar: string }) => {
      if (v.id) {
        const { error } = await supabase.from("expense_categories").update({ label: v.label, label_ar: v.label_ar || null }).eq("id", v.id);
        if (error) throw error;
      } else {
        const code = v.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `cat_${Date.now()}`;
        const { error } = await supabase.from("expense_categories").insert({ code, label: v.label, label_ar: v.label_ar || null, is_shared: true } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("expenseCategories")}</DialogTitle>
          <DialogDescription>{t("expenseCategoriesHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {(catsQ.data ?? []).map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input defaultValue={c.label} aria-label={t("nameEnglish")} onBlur={(e) => e.target.value.trim() && e.target.value !== c.label && upsert.mutate({ id: c.id, label: e.target.value.trim(), label_ar: c.label_ar ?? "" })} />
              <Input defaultValue={c.label_ar ?? ""} dir="rtl" aria-label={t("nameArabic")} onBlur={(e) => e.target.value !== (c.label_ar ?? "") && upsert.mutate({ id: c.id, label: c.label, label_ar: e.target.value.trim() })} />
              <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => setToDelete(c.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <form
          className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const label = String(f.get("label") || "").trim();
            if (!label) return;
            upsert.mutate({ label, label_ar: String(f.get("label_ar") || "").trim() });
            e.currentTarget.reset();
          }}
        >
          <Input name="label" placeholder={t("nameEnglish")} required />
          <Input name="label_ar" placeholder={t("nameArabic")} dir="rtl" />
          <Button type="submit">{t("add")}</Button>
        </form>
        <ConfirmDelete
          open={!!toDelete}
          onOpenChange={(v) => !v && setToDelete(null)}
          onConfirm={() => {
            if (toDelete) del.mutate(toDelete);
            setToDelete(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
