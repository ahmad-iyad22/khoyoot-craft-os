import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { MoneyFields, readMoney, useAppSettings, fmtMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { PageHeader, AccessDenied } from "@/components/app-shell";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload, openReceipt } from "@/components/receipt-upload";
import { TatreezEmptyState } from "@/components/tatreez";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({ meta: [
    { title: "Assets — Khoyoot" },
    { name: "description", content: "Business assets, purchase values and linked partner expenses." },
    { property: "og:title", content: "Assets — Khoyoot" },
    { property: "og:description", content: "Business assets, purchase values and linked partner expenses." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AssetsPage,
});
type Asset = Tables<"assets">;
type Partner = Pick<Tables<"partners">, "id" | "name" | "active">;
type Split = { partner_id: string; percent: number };
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function AssetsPage() {
  const { t } = useI18n();
  const roles = useRoles();
  const qc = useQueryClient();
  const base = useAppSettings().data?.base_currency ?? "MYR";
  const [editing, setEditing] = useState<{ row: Asset | null } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const assets = useQuery({ queryKey: ["assets"], enabled: roles.isOwner, queryFn: async () => {
    const { data, error } = await supabase.from("assets").select("*").order("purchase_date", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  const partners = useQuery({ queryKey: ["asset-partners"], enabled: roles.isOwner, queryFn: async () => {
    const { data, error } = await supabase.from("partners").select("id,name,active").order("created_at");
    if (error) throw error; return data ?? [];
  } });
  const refresh = () => {
    for (const key of ["assets", "shared-expenses", "expenses", "expense-categories", "month-statement", "partner-ledger", "audit-log", "category-budget-status", "dashboard-summary"]) qc.invalidateQueries({ queryKey: [key] });
  };
  const save = useMutation({ mutationFn: async (v: { id?: string | undefined; payload: Omit<Asset, "id" | "created_at" | "created_by" | "updated_at" | "expense_id"> }) => {
    const { error } = v.id ? await supabase.from("assets").update(v.payload).eq("id", v.id) : await supabase.from("assets").insert(v.payload);
    if (error) throw error;
  }, onSuccess: () => { refresh(); setEditing(null); toast.success(t("saved")); }, onError: (e: Error) => toast.error(e.message.includes("SPLIT_NOT_100") ? t("splitMust100") : e.message) });
  const remove = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("assets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { refresh(); setDeleting(null); toast.success(t("deleted")); }, onError: (e: Error) => toast.error(e.message) });
  if (!roles.isLoading && !roles.isOwner) return <AccessDenied />;
  const rows = assets.data ?? [];
  return <div>
    <PageHeader title={t("assets")} action={<Button onClick={() => setEditing({ row: null })}><Plus className="size-4" />{t("asset_add")}</Button>} />
    <div className="mb-5 border-s-4 border-primary ps-4"><p className="text-sm text-muted-foreground">{t("asset_activeValue")}</p><p className="font-display text-2xl tabular-nums">{fmtMoney(rows.filter(a => a.status === "active").reduce((n, a) => n + Number(a.base_amount), 0), base)}</p></div>
    {assets.error && <p role="alert" className="text-destructive">{assets.error.message}</p>}
    <div className="card-surface overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
      <thead><tr>{["name", "category", "asset_purchaseDate", "paidBy", "status", "amount"].map(k => <th key={k} className="p-3 text-start text-muted-foreground">{t(k)}</th>)}<th /></tr></thead>
      <tbody>{rows.map(a => <tr key={a.id} className="border-t">
        <td className="p-3"><p className="font-medium" dir="auto">{a.name}</p>{a.notes && <p className="max-w-56 whitespace-pre-wrap text-xs text-muted-foreground" dir="auto">{a.notes}</p>}{a.expense_id && <Link to="/shared-expenses" className="text-xs text-primary underline">{t("asset_linkedExpense")}</Link>}</td>
        <td className="p-3" dir="auto">{a.category}</td><td className="p-3 whitespace-nowrap">{formatDate(a.purchase_date)}</td>
        <td className="p-3">{partners.data?.find(p => p.id === a.paid_by_partner_id)?.name ?? (a.paid_by_partner_id ? "—" : t("businessAccount"))}</td>
        <td className="p-3"><Badge variant={a.status === "written_off" ? "destructive" : a.status === "active" ? "secondary" : "outline"}>{t(`asset_${a.status}`)}</Badge></td>
        <td className="p-3 tabular-nums whitespace-nowrap">{fmtMoney(a.amount, a.currency)}{a.currency !== base && <p className="text-xs text-muted-foreground">{fmtMoney(a.base_amount, base)}</p>}</td>
        <td className="p-3"><div className="flex justify-end">{a.receipt_path && <Button variant="ghost" size="icon" aria-label={t("viewReceipt")} onClick={() => a.receipt_path && openReceipt(a.receipt_path)}><Paperclip className="size-4" /></Button>}<Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditing({ row: a })}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => setDeleting(a.id)}><Trash2 className="size-4" /></Button></div></td>
      </tr>)}</tbody></table>{!rows.length && !assets.isLoading && <TatreezEmptyState title={t("asset_empty")} />}</div>
    <ConfirmDelete open={!!deleting} onOpenChange={v => !v && setDeleting(null)} description={t("asset_deleteWarning")} onConfirm={() => deleting && !remove.isPending && remove.mutate(deleting)} />
    <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{t(editing?.row ? "asset_edit" : "asset_add")}</DialogTitle></DialogHeader>
      {editing && <AssetForm key={editing.row?.id ?? "new"} row={editing.row} partners={partners.data ?? []} pending={save.isPending} onSave={payload => save.mutate({ id: editing.row?.id, payload })} />}
    </DialogContent></Dialog>
  </div>;
}

function AssetForm({ row, partners, pending, onSave }: { row: Asset | null; partners: Partner[]; pending: boolean; onSave: (v: Omit<Asset, "id" | "created_at" | "created_by" | "updated_at" | "expense_id">) => void }) {
  const { t } = useI18n();
  const [payer, setPayer] = useState(row?.paid_by_partner_id ?? "");
  const [splits, setSplits] = useState<Split[]>(() => Array.isArray(row?.expense_splits) && row.expense_splits.length ? row.expense_splits as unknown as Split[] : partners.filter(p => p.active).map(p => ({ partner_id: p.id, percent: 100 / partners.filter(x => x.active).length })));
  return <form className="space-y-4" onSubmit={e => {
    e.preventDefault();
    if (payer && (!splits.length || splits.some(s => !Number.isFinite(s.percent) || s.percent < 0 || s.percent > 100) || Math.abs(splits.reduce((n, s) => n + s.percent, 0) - 100) > .01)) { toast.error(t("splitMust100")); return; }
    const f = new FormData(e.currentTarget);
    onSave({ name: String(f.get("name")).trim(), category: String(f.get("category")).trim(), purchase_date: String(f.get("purchase_date")), ...readMoney(f), paid_by_partner_id: payer || null, status: String(f.get("status")), notes: String(f.get("notes") || "") || null, receipt_path: String(f.get("receipt_path") || "") || null, expense_splits: splits });
  }}>
    <div className="space-y-2"><Label htmlFor="asset-name">{t("name")}</Label><Input id="asset-name" name="name" required dir="auto" defaultValue={row?.name ?? ""} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="asset-category">{t("category")}</Label><Input id="asset-category" name="category" required dir="auto" defaultValue={row?.category ?? ""} /></div><div className="space-y-2"><Label htmlFor="asset-date">{t("asset_purchaseDate")}</Label><Input id="asset-date" name="purchase_date" type="date" required defaultValue={row?.purchase_date ?? new Date().toISOString().slice(0, 10)} /></div></div>
    <MoneyFields idPrefix="asset" defaultAmount={row?.amount ?? null} defaultCurrency={row?.currency ?? null} defaultFx={row?.fx_rate_to_base ?? null} />
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="asset-payer">{t("paidBy")}</Label><select id="asset-payer" className={selectClass} value={payer} onChange={e => setPayer(e.target.value)}><option value="">{t("businessAccount")}</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="asset-status">{t("status")}</Label><select id="asset-status" name="status" className={selectClass} defaultValue={row?.status ?? "active"}>{["active", "sold", "written_off"].map(s => <option key={s} value={s}>{t(`asset_${s}`)}</option>)}</select></div></div>
    {payer && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">{t("split")}</legend>{splits.map(s => <div key={s.partner_id} className="grid grid-cols-[1fr_110px] items-center gap-3"><Label htmlFor={`asset-split-${s.partner_id}`}>{partners.find(p => p.id === s.partner_id)?.name ?? "—"} (%)</Label><Input id={`asset-split-${s.partner_id}`} type="number" min="0" max="100" step="any" value={s.percent} onChange={e => setSplits(v => v.map(x => x.partner_id === s.partner_id ? { ...x, percent: Number(e.target.value) } : x))} /></div>)}</fieldset>}
    <div className="space-y-2"><Label htmlFor="asset-notes">{t("notes")}</Label><Textarea id="asset-notes" name="notes" dir="auto" defaultValue={row?.notes ?? ""} /></div>
    <ReceiptUpload idPrefix="asset" defaultPath={row?.receipt_path ?? null} />
    <DialogFooter><Button type="submit" disabled={pending}>{t("save")}</Button></DialogFooter>
  </form>;
}