import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { TatreezEmptyState } from "@/components/tatreez";

export const Route = createFileRoute("/_authenticated/waitlist")({
  head: () => ({ meta: [
    { title: "Waitlist — Khoyoot" }, { name: "description", content: "Interested buyers by product and stock availability." },
    { property: "og:title", content: "Waitlist — Khoyoot" }, { property: "og:description", content: "Interested buyers by product and stock availability." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: WaitlistPage,
});
const statuses = ["waiting", "contacted", "completed", "cancelled"];
const empty = { product_id: "", buyer_name: "", contact: "", platform: "", notes: "", status: "waiting" };
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function WaitlistPage() {
  const { t } = useI18n(); const roles = useRoles(); const qc = useQueryClient();
  const allowed = roles.isOwner || roles.isOperations || roles.isMarketing;
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty); const [del, setDel] = useState<string | null>(null);
  const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const rowsQ = useQuery({ queryKey: ["waitlist"], enabled: allowed, queryFn: async () => {
    const { data, error } = await supabase.from("waitlist").select("*").order("created_at"); if (error) throw error; return data ?? [];
  } });
  const productsQ = useQuery({ queryKey: ["waitlist-products"], enabled: allowed, queryFn: async () => {
    const { data, error } = await supabase.from("products").select("id,name,sku,image_url,stock_qty,archived").order("name"); if (error) throw error; return data ?? [];
  } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["waitlist"] }); };
  const save = useMutation({ mutationFn: async () => {
    if (!form.product_id || !form.buyer_name.trim()) throw new Error(t("cw_invalid"));
    const payload = { ...form, buyer_name: form.buyer_name.trim() };
    const { error } = editing ? await supabase.from("waitlist").update(payload).eq("id", editing) : await supabase.from("waitlist").insert(payload);
    if (error) throw error;
  }, onSuccess: () => { setOpen(false); refresh(); toast.success(t("saved")); }, onError: (e: Error) => toast.error(e.message) });
  const update = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => {
    const { error } = await supabase.from("waitlist").update({ status }).eq("id", id); if (error) throw error;
  }, onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.from("waitlist").delete().eq("id", id); if (error) throw error;
  }, onSuccess: () => { setDel(null); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  if (!allowed && !roles.isLoading) return <AccessDenied />;
  const product = (id: string) => productsQ.data?.find(p => p.id === id);
  const rows = (rowsQ.data ?? []).filter(r => (filter === "all" || r.status === filter || (filter === "ready" && r.status === "waiting" && Number(product(r.product_id)?.stock_qty) > 0)) &&
    [r.buyer_name, r.contact, product(r.product_id)?.name, product(r.product_id)?.sku].some(v => v?.toLowerCase().includes(search.toLowerCase())));
  return <div className="space-y-6">
    <PageHeader title={t("waitlist")} action={<Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="size-4" />{t("cw_addBuyer")}</Button>} />
    <div className="flex flex-wrap gap-3"><Input aria-label={t("search")} placeholder={t("search")} className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label={t("status")} className={`${selectClass} max-w-xs`} value={filter} onChange={e => setFilter(e.target.value)}>{["all", "ready", ...statuses].map(s => <option key={s} value={s}>{t(`cw_${s}`)}</option>)}</select></div>
    {rowsQ.error || productsQ.error ? <div role="alert">{t("cw_failed")}<Button variant="outline" onClick={() => { void rowsQ.refetch(); void productsQ.refetch(); }}>{t("cw_retry")}</Button></div> : rowsQ.isLoading ? <p>{t("loading")}</p> : rows.length === 0 ? <TatreezEmptyState title={t("cw_emptyWaitlist")} /> :
    <div className="space-y-3">{rows.map(r => { const p = product(r.product_id); return <div key={r.id} className="card-surface flex flex-wrap items-center gap-4 p-4">
      <ProductThumbnail url={p?.image_url ?? null} name={p?.name ?? null} /><div className="min-w-0 flex-1"><h2 className="break-words font-display text-lg">{r.buyer_name}</h2><p className="text-sm">{p?.name} · {p?.sku}</p><p className="break-words text-sm text-muted-foreground">{r.contact} {r.platform}</p>{r.notes && <p className="whitespace-pre-wrap text-sm">{r.notes}</p>}</div>
      <Badge variant={r.status === "waiting" && Number(p?.stock_qty) > 0 ? "default" : "secondary"}>{r.status === "waiting" && Number(p?.stock_qty) > 0 ? t("cw_ready") : t(`cw_${r.status}`)}</Badge>
      <div className="flex gap-1">{r.status === "waiting" && <Button size="icon" variant="outline" aria-label={t("cw_markContacted")} title={t("cw_markContacted")} disabled={update.isPending} onClick={() => update.mutate({ id: r.id, status: "contacted" })}><Check className="size-4" /></Button>}
      <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => { setEditing(r.id); setForm({ product_id: r.product_id, buyer_name: r.buyer_name, contact: r.contact ?? "", platform: r.platform ?? "", notes: r.notes ?? "", status: r.status }); setOpen(true); }}><Pencil className="size-4" /></Button>
      <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDel(r.id)}><Trash2 className="size-4" /></Button></div>
    </div>; })}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{t(editing ? "cw_editBuyer" : "cw_addBuyer")}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <Label htmlFor="wait-product">{t("cw_product")}</Label><select id="wait-product" required className={selectClass} value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}><option value="">{t("cw_choose")}</option>{productsQ.data?.filter(p => !p.archived || p.id === form.product_id).map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select>
        {(["buyer_name", "contact", "platform"] as const).map(k => <div key={k} className="space-y-1"><Label htmlFor={`wait-${k}`}>{t(k === "buyer_name" ? "cw_buyer" : k === "contact" ? "cw_contact" : "platform")}</Label><Input id={`wait-${k}`} required={k === "buyer_name"} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>)}
        <Label htmlFor="wait-status">{t("status")}</Label><select id="wait-status" className={selectClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{statuses.map(s => <option key={s} value={s}>{t(`cw_${s}`)}</option>)}</select>
        <Label htmlFor="wait-notes">{t("notes")}</Label><Textarea id="wait-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <DialogFooter><Button disabled={save.isPending} type="submit">{t("save")}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <ConfirmDelete open={!!del} onOpenChange={v => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />
  </div>;
}