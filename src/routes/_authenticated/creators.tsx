import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAppSettings, fmtMoney } from "@/lib/money";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { TatreezEmptyState } from "@/components/tatreez";

export const Route = createFileRoute("/_authenticated/creators")({ head: () => ({ meta: [
  { title: "Creators — Khoyoot" }, { name: "description", content: "Creator contacts, commissions, samples and recorded results." },
  { property: "og:title", content: "Creators — Khoyoot" }, { property: "og:description", content: "Creator contacts, commissions, samples and recorded results." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: CreatorsPage });
const empty = { name: "", platform: "", handle: "", contact: "", commission_percent: "", notes: "" };
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
type Deletion = { kind: "creator" | "result"; id: string };

function CreatorsPage() {
  const { t } = useI18n(); const roles = useRoles(); const qc = useQueryClient(); const currency = useAppSettings().data?.base_currency ?? "MYR";
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState(""); const [del, setDel] = useState<Deletion | null>(null);
  const [entry, setEntry] = useState<"sample" | "result" | null>(null); const [resultId, setResultId] = useState<string | null>(null);
  const [values, setValues] = useState({ product_id: "", quantity: "", date: "", orders: "", revenue: "", commission_percent: "", notes: "" });
  const dataQ = useQuery({ queryKey: ["creators-data"], enabled: roles.isMarketing, queryFn: async () => {
    const [creators, samples, results, products] = await Promise.all([
      supabase.from("creators").select("*").order("name"), supabase.from("creator_samples").select("*").order("sent_on", { ascending: false }),
      supabase.from("creator_results").select("*").order("period_date", { ascending: false }),
      supabase.from("products").select("id,name,sku,image_url,stock_qty,archived").order("name"),
    ]);
    for (const response of [creators, samples, results, products]) if (response.error) throw response.error;
    return { creators: creators.data ?? [], samples: samples.data ?? [], results: results.data ?? [], products: products.data ?? [] };
  } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["creators-data"] }); };
  const save = useMutation({ mutationFn: async () => {
    const rate = Number(form.commission_percent);
    if (!form.name.trim() || form.commission_percent === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error(t("cw_invalid"));
    const payload = { ...form, name: form.name.trim(), commission_percent: rate };
    const { error } = editing ? await supabase.from("creators").update(payload).eq("id", editing) : await supabase.from("creators").insert(payload); if (error) throw error;
  }, onSuccess: () => { setOpen(false); refresh(); toast.success(t("saved")); }, onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: async (target: Deletion) => {
    if (target.kind === "creator") {
      const { count, error } = await supabase.from("creator_samples").select("id", { count: "exact", head: true }).eq("creator_id", target.id);
      if (error) throw error; if (count) throw new Error(t("cw_hasSamples"));
    }
    const { error } = await supabase.from(target.kind === "creator" ? "creators" : "creator_results").delete().eq("id", target.id); if (error) throw error;
  }, onSuccess: () => { setDel(null); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const record = useMutation({ mutationFn: async () => {
    if (!selected || !values.date) throw new Error(t("cw_invalid"));
    if (entry === "sample") {
      const quantity = Number(values.quantity); const product = dataQ.data?.products.find(p => p.id === values.product_id);
      if (!product || !Number.isInteger(quantity) || quantity <= 0) throw new Error(t("cw_invalid"));
      if (quantity > product.stock_qty) throw new Error(t("cw_stockError"));
      const { error } = await supabase.rpc("send_creator_sample", { _creator_id: selected, _product_id: product.id, _qty: quantity, _date: values.date, _notes: values.notes }); if (error) throw error;
    } else {
      const orders = Number(values.orders), revenue = Number(values.revenue), rate = Number(values.commission_percent);
      if ([values.orders, values.revenue, values.commission_percent].some(v => v === "") || !Number.isInteger(orders) || orders < 0 || !Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error(t("cw_invalid"));
      const payload = { creator_id: selected, period_date: values.date, orders, revenue, commission_percent: rate, notes: values.notes };
      const { error } = resultId ? await supabase.from("creator_results").update(payload).eq("id", resultId) : await supabase.from("creator_results").insert(payload); if (error) throw error;
    }
  }, onSuccess: () => { setEntry(null); refresh(); void qc.invalidateQueries({ queryKey: ["products"] }); void qc.invalidateQueries({ queryKey: ["waitlist-products"] }); toast.success(t("saved")); }, onError: (e: Error) => toast.error(e.message) });
  if (!roles.isMarketing && !roles.isLoading) return <AccessDenied />;
  const data = dataQ.data; const creator = data?.creators.find(c => c.id === selected);
  const samples = data?.samples.filter(s => s.creator_id === selected) ?? []; const results = data?.results.filter(r => r.creator_id === selected) ?? [];
  const startEntry = (kind: "sample" | "result") => { setResultId(null); setValues({ product_id: "", quantity: "", date: new Date().toISOString().slice(0, 10), orders: "", revenue: "", commission_percent: String(creator?.commission_percent ?? ""), notes: "" }); setEntry(kind); };
  return <div className="space-y-6">
    <PageHeader title={t("creators")} action={<Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="size-4" />{t("cw_addCreator")}</Button>} />
    {dataQ.error ? <div role="alert">{t("cw_failed")}<Button variant="outline" onClick={() => void dataQ.refetch()}>{t("cw_retry")}</Button></div> : dataQ.isLoading ? <p>{t("loading")}</p> : !data?.creators.length ? <TatreezEmptyState title={t("cw_emptyCreators")} /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.creators.map(c => <div key={c.id} className="card-surface space-y-2 p-4">
        <Button variant="link" className="h-auto max-w-full whitespace-normal p-0 text-start font-display text-lg" onClick={() => setSelected(c.id)}>{c.name}</Button>
        <p className="break-words text-sm text-muted-foreground">{c.platform} {c.handle} · {c.contact}</p><p className="text-sm">{t("cw_commission")}: {c.commission_percent}</p>{c.notes && <p className="whitespace-pre-wrap text-sm">{c.notes}</p>}
        <div className="flex gap-1"><Button size="sm" variant={selected === c.id ? "default" : "outline"} onClick={() => setSelected(c.id)}>{t("cw_results")}</Button>
          <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => { setEditing(c.id); setForm({ name: c.name, platform: c.platform, handle: c.handle ?? "", contact: c.contact ?? "", commission_percent: String(c.commission_percent), notes: c.notes ?? "" }); setOpen(true); }}><Pencil className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDel({ kind: "creator", id: c.id })}><Trash2 className="size-4" /></Button></div>
      </div>)}</div>
      {creator && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl">{creator.name}</h2><div className="flex flex-wrap gap-2">{roles.isOperations && <Button variant="outline" onClick={() => startEntry("sample")}><Send className="size-4" />{t("cw_sendSample")}</Button>}<Button onClick={() => startEntry("result")}><Plus className="size-4" />{t("cw_addResult")}</Button></div></div>
        <div className="flex flex-wrap gap-6 text-sm"><p>{t("orders")}: {results.reduce((n, r) => n + r.orders, 0)}</p><p>{t("revenue")}: {fmtMoney(results.reduce((n, r) => n + Number(r.revenue), 0), currency)}</p><p>{t("cw_commissionValue")}: {fmtMoney(results.reduce((n, r) => n + Number(r.revenue) * Number(r.commission_percent) / 100, 0), currency)}</p></div>
        <h3 className="font-display text-lg">{t("cw_results")}</h3>{results.length === 0 ? <p className="text-sm text-muted-foreground">{t("cw_emptyResults")}</p> : results.map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm"><span>{r.period_date}</span><span>{t("orders")}: {r.orders}</span><span>{fmtMoney(r.revenue, currency)}</span><span>{r.commission_percent}%</span><span className="min-w-0 flex-1 break-words">{r.notes}</span><Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => { setResultId(r.id); setValues({ product_id: "", quantity: "", date: r.period_date, orders: String(r.orders), revenue: String(r.revenue), commission_percent: String(r.commission_percent), notes: r.notes ?? "" }); setEntry("result"); }}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDel({ kind: "result", id: r.id })}><Trash2 className="size-4" /></Button></div>)}
        <h3 className="font-display text-lg">{t("cw_samples")}</h3>{samples.length === 0 ? <p className="text-sm text-muted-foreground">{t("cw_emptySamples")}</p> : samples.map(s => { const p = data.products.find(p => p.id === s.product_id); return <div key={s.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm"><ProductThumbnail url={p?.image_url ?? null} name={p?.name ?? null} /><span>{p?.name} · {p?.sku}</span><span>{t("quantity")}: {s.quantity}</span><span>{s.sent_on}</span><span>{t("cw_cost")}: {fmtMoney(s.cost_amount, currency)}</span><span>{s.notes}</span></div>; })}
      </section>}
    </>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{t(editing ? "cw_editCreator" : "cw_addCreator")}</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      {(["name", "platform", "handle", "contact", "commission_percent"] as const).map(k => <div key={k} className="space-y-1"><Label htmlFor={`creator-${k}`}>{t(k === "handle" ? "cw_handle" : k === "contact" ? "cw_contact" : k === "commission_percent" ? "cw_commission" : k)}</Label><Input id={`creator-${k}`} required={k === "name" || k === "commission_percent"} type={k === "commission_percent" ? "number" : "text"} min={0} max={k === "commission_percent" ? 100 : undefined} step="0.01" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>)}
      <Label htmlFor="creator-notes">{t("notes")}</Label><Textarea id="creator-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /><DialogFooter><Button type="submit" disabled={save.isPending}>{t("save")}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={entry !== null} onOpenChange={v => !v && setEntry(null)}><DialogContent className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{t(entry === "sample" ? "cw_sendSample" : "cw_addResult")}</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={e => { e.preventDefault(); record.mutate(); }}>
      {entry === "sample" && <><p className="text-sm text-warning">{t("cw_sampleWarning")}</p><Label htmlFor="sample-product">{t("cw_product")}</Label><select id="sample-product" className={selectClass} required value={values.product_id} onChange={e => setValues({ ...values, product_id: e.target.value })}><option value="">{t("cw_choose")}</option>{data?.products.filter(p => !p.archived && p.stock_qty > 0).map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name} · {t("cw_available")}: {p.stock_qty}</option>)}</select></>}
      {(["date", ...(entry === "sample" ? ["quantity"] : ["orders", "revenue", "commission_percent"])] as Array<"date" | "quantity" | "orders" | "revenue" | "commission_percent">).map(k => <div key={k} className="space-y-1"><Label htmlFor={`entry-${k}`}>{t(k === "commission_percent" ? "cw_commission" : k)}</Label><Input id={`entry-${k}`} required type={k === "date" ? "date" : "number"} min={k === "quantity" ? 1 : 0} max={k === "commission_percent" ? 100 : undefined} step={k === "quantity" || k === "orders" ? "1" : "0.01"} value={values[k]} onChange={e => setValues({ ...values, [k]: e.target.value })} /></div>)}
      <Label htmlFor="entry-notes">{t("notes")}</Label><Textarea id="entry-notes" value={values.notes} onChange={e => setValues({ ...values, notes: e.target.value })} /><DialogFooter><Button type="submit" disabled={record.isPending}>{t("save")}</Button></DialogFooter></form></DialogContent></Dialog>
    <ConfirmDelete open={!!del} onOpenChange={v => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} description={del?.kind === "creator" ? t("cw_creatorDelete") : undefined} />
  </div>;
}