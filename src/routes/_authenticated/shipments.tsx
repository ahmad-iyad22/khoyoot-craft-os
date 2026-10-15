import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, LayoutGrid, List, Lock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n, tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload } from "@/components/receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";
import { fmtMoney, useAppSettings } from "@/lib/money";
import { SHIPMENT_STAGES, allocateByWeight, formatPercent } from "@/lib/margin";

export const Route = createFileRoute("/_authenticated/shipments")({
  head: () => ({
    meta: [
      { title: "Shipping — Khoyoot" },
      { name: "description", content: "Palestine to Malaysia shipments with weight-based shipping and customs allocation." },
      { property: "og:title", content: "Shipping — Khoyoot" },
      { property: "og:description", content: "Shipment stages, landed cost per piece, batch codes and serials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShipmentsPage,
});

type Line = { product_id: string; quantity: string; grams: string; cost: string };
type Cost = { amount: string; currency: string; fx: string; payer: string };

const ERR_CODES = [
  "REFERENCE_REQUIRED", "INVALID_AMOUNT", "SPLIT_NOT_100", "SHIPMENT_LOCKED", "ALREADY_ADDED", "COST_PENDING",
  "NO_LINES", "NO_WEIGHT", "INVALID_QUANTITY", "INVALID_WEIGHT", "OWNER_REQUIRED_PARTNER_PAYER", "USE_ADD_TO_INVENTORY",
  "STOCK_ALREADY_SOLD",
];
function errMsg(e: unknown) {
  const m = (e as Error)?.message ?? String(e);
  const code = ERR_CODES.find((c) => m.includes(c));
  return code ? tt(`sh_err_${code}`) : m;
}
const num = (v: unknown) => Number(v ?? 0) || 0;
const today = () => new Date().toISOString().slice(0, 10);

function lineAlloc(s: any) {
  const items = [...(s.shipment_items ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  return {
    items,
    alloc: allocateByWeight(
      num(s.shipping_base),
      num(s.customs_base),
      items.map((i: any) => ({ quantity: num(i.quantity), weight_kg: num(i.total_weight_kg), product_cost: i.product_cost === null ? null : num(i.product_cost) })),
    ),
  };
}

function ShipmentsPage() {
  const roles = useRoles();
  const { t, ts } = useI18n();
  const qc = useQueryClient();
  const base = useAppSettings().data?.base_currency ?? "MYR";
  const currencies = useAppSettings().data?.currencies ?? [base];

  const [view, setView] = useState<"list" | "kanban">("list");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [toUndo, setToUndo] = useState<any>(null);
  const [manyOpen, setManyOpen] = useState(false);
  const [many, setMany] = useState<Record<string, string>>({});
  const [toReceive, setToReceive] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("preparing");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [sender, setSender] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [costDate, setCostDate] = useState(today());
  const [ship, setShip] = useState<Cost>({ amount: "0", currency: base, fx: "1", payer: "business" });
  const [cust, setCust] = useState<Cost>({ amount: "0", currency: base, fx: "1", payer: "business" });
  const [split, setSplit] = useState<Record<string, string>>({});
  const [owedTo, setOwedTo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [formKey, setFormKey] = useState(0);

  const productsQ = useQuery({
    queryKey: ["ship-products"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, image_url, sale_price, weight_grams, margin_alert_threshold")
        .eq("archived", false)
        .order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });
  const partnersQ = useQuery({
    queryKey: ["ship-partners"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name, active").order("created_at");
      return data ?? [];
    },
  });
  const suppliersQ = useQuery({
    queryKey: ["ship-suppliers"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data ?? [];
    },
  });
  const shipmentsQ = useQuery({
    queryKey: ["shipments"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, shipment_items(*, products(id, sku, name, image_url, sale_price, margin_alert_threshold))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = productsQ.data ?? [];
  const partners = partnersQ.data ?? [];
  const partnerName = (id?: string | null) => partners.find((p) => p.id === id)?.name ?? "—";
  const defaultOwed = () => partners.find((p) => p.name.trim().toLowerCase() === "may")?.id ?? "";

  const toBase = (c: Cost) => num(c.amount) * (c.currency === base ? 1 : num(c.fx));
  const preview = useMemo(
    () =>
      allocateByWeight(
        Math.round(toBase(ship) * 100) / 100,
        Math.round(toBase(cust) * 100) / 100,
        lines.map((l) => ({ quantity: num(l.quantity), weight_kg: (num(l.quantity) * num(l.grams)) / 1000, product_cost: l.cost === "" ? null : num(l.cost) })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ship, cust, lines, base],
  );
  const splitTotal = Object.values(split).reduce((s, v) => s + num(v), 0);
  const splitFilled = Object.values(split).some((v) => v !== "");

  function reset() {
    setEditingId(null);
    setReference("");
    setStatus("preparing");
    setDates({ preparing: today() });
    setSender("");
    setNotes("");
    setReceipt(null);
    setCostDate(today());
    setShip({ amount: "0", currency: base, fx: "1", payer: "business" });
    setCust({ amount: "0", currency: base, fx: "1", payer: "business" });
    setSplit({});
    setOwedTo(defaultOwed());
    setLines([]);
    setFormKey((k) => k + 1);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setReference(s.reference ?? "");
    setStatus(s.status);
    setDates({ ...(s.status_dates ?? {}) });
    setSender(s.sender_partner_id ? `p:${s.sender_partner_id}` : s.sender_supplier_id ? `s:${s.sender_supplier_id}` : "");
    setNotes(s.notes ?? "");
    setReceipt(s.receipt_path ?? null);
    setCostDate(String(s.created_at).slice(0, 10));
    setShip({ amount: String(s.total_shipping_cost ?? 0), currency: s.currency ?? base, fx: String(s.shipping_fx ?? 1), payer: s.shipping_paid_by_partner_id ?? "business" });
    setCust({ amount: String(s.customs_cost ?? 0), currency: s.customs_currency ?? base, fx: String(s.customs_fx ?? 1), payer: s.customs_paid_by_partner_id ?? "business" });
    const sp: Record<string, string> = {};
    for (const x of (s.profit_split ?? []) as any[]) sp[x.partner_id] = String(x.percent);
    setSplit(sp);
    setOwedTo(s.cost_owed_partner_id ?? "");
    setLines(
      [...(s.shipment_items ?? [])]
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((i: any) => ({
          product_id: i.product_id,
          quantity: String(i.quantity),
          grams: String(i.unit_weight_grams ?? 0),
          cost: i.product_cost === null ? "" : String(i.product_cost),
        })),
    );
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shipments"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["partner-transactions"] });
  };

  const saveM = useMutation({
    mutationFn: async (receiptPath: string) => {
      if (lines.some((l) => !l.product_id)) throw new Error(tt("sh_err_product"));
      if (splitFilled && Math.abs(splitTotal - 100) > 0.01) throw new Error(tt("sh_err_SPLIT_NOT_100"));
      const payload = {
        reference,
        status,
        status_dates: dates,
        notes,
        receipt_path: receiptPath,
        sender_partner_id: sender.startsWith("p:") ? sender.slice(2) : "",
        sender_supplier_id: sender.startsWith("s:") ? sender.slice(2) : "",
        shipping_amount: num(ship.amount),
        shipping_currency: ship.currency,
        shipping_fx: ship.currency === base ? 1 : num(ship.fx),
        shipping_paid_by_partner_id: ship.payer === "business" ? "" : ship.payer,
        customs_amount: num(cust.amount),
        customs_currency: cust.currency,
        customs_fx: cust.currency === base ? 1 : num(cust.fx),
        customs_paid_by_partner_id: cust.payer === "business" ? "" : cust.payer,
        cost_date: costDate,
        cost_owed_partner_id: owedTo,
        profit_split: splitFilled ? Object.entries(split).filter(([, v]) => v !== "").map(([partner_id, v]) => ({ partner_id, percent: num(v) })) : [],
      };
      const items = lines.map((l) => ({ product_id: l.product_id, quantity: num(l.quantity), unit_weight_grams: num(l.grams), product_cost: l.cost }));
      const { error } = await supabase.rpc("save_shipment", { _id: editingId as string, _s: payload as any, _items: items as any });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("sh_saved"));
      invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_shipment", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("sh_deleted"));
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const receiveM = useMutation({
    mutationFn: async (s: any) => {
      const { data, error } = await supabase.rpc("receive_shipment", { _shipment_id: s.id });
      if (error) throw error;
      return { s, data: data as any };
    },
    onSuccess: ({ s, data }) => {
      toast.success(tt("sh_added"));
      if (data?.split_missing) toast.warning(tt("sh_splitMissing"));
      setResult({ reference: s.reference, lines: data?.lines ?? [], split_missing: data?.split_missing });
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const undoM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("undo_shipment_receipt" as any, { _id: id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("sh_undone"));
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const stageM = useMutation({
    mutationFn: async ({ s, next }: { s: any; next: string }) => {
      const { error } = await supabase
        .from("shipments")
        .update({ status: next as any, status_dates: { ...(s.status_dates ?? {}), [next]: today() } })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("sh_saved"));
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!roles.isOperations) return <AccessDenied />;

  const all = shipmentsQ.data ?? [];
  const q = search.trim().toLowerCase();
  const visible = all.filter((s: any) => (filter === "all" || s.status === filter) && (!q || String(s.reference).toLowerCase().includes(q)));
  const editable = (s: any) => s.status !== "added_to_inventory";
  const kg = t("sh_kg");

  const payerSelect = (c: Cost, set: (c: Cost) => void, id: string) => (
    <select id={id} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={c.payer} onChange={(e) => set({ ...c, payer: e.target.value })}>
      <option value="business">{t("businessAccount")}</option>
      {partners.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );

  const costBlock = (label: string, c: Cost, set: (c: Cost) => void, id: string) => (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Input aria-label={t("amount")} type="number" step="0.01" min="0" value={c.amount} onChange={(e) => set({ ...c, amount: e.target.value })} />
        <select aria-label={t("currency")} className="h-9 rounded-md border bg-background px-2 text-sm" value={c.currency} onChange={(e) => set({ ...c, currency: e.target.value, fx: e.target.value === base ? "1" : c.fx })}>
          {currencies.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
      </div>
      {c.currency !== base && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-fx`}>{t("fxRate").replace("{cur}", c.currency).replace("{base}", base)}</Label>
          <Input id={`${id}-fx`} type="number" step="0.000001" min="0.000001" value={c.fx} onChange={(e) => set({ ...c, fx: e.target.value })} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("convertedAmount")}: {fmtMoney(toBase(c), base)}</p>
      <div className="space-y-1">
        <Label htmlFor={`${id}-payer`}>{t("sh_paidBy")}</Label>
        {payerSelect(c, set, `${id}-payer`)}
      </div>
    </div>
  );

  const card = (s: any, compact = false) => {
    const { items, alloc } = lineAlloc(s);
    const landedTotal = items.reduce((sum: number, i: any, n: number) => sum + (alloc.lines[n]?.landedUnit ?? 0) * num(i.quantity), 0);
    const idx = SHIPMENT_STAGES.indexOf(s.status);
    const next = SHIPMENT_STAGES[idx + 1];
    const pending = items.some((i: any) => i.product_cost === null);
    return (
      <div key={s.id} className="card-surface flex flex-col gap-3 p-4">
        <div className="tatreez-band h-1 w-12 rounded-full" />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-lg">{s.reference}</p>
            <p className="text-xs text-muted-foreground">
              {t("sh_sender")}: {s.sender_partner_id ? partnerName(s.sender_partner_id) : (suppliersQ.data ?? []).find((x) => x.id === s.sender_supplier_id)?.name ?? "—"}
            </p>
          </div>
          <StatusBadge status={s.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-muted/50 p-3 text-xs">
          <span>{t("sh_totalWeight")}</span><span className="text-end font-medium" dir="ltr">{alloc.totalWeight.toFixed(3)} {kg}</span>
          <span>{t("sh_shippingCost")}</span><span className="text-end font-medium" dir="ltr">{fmtMoney(s.shipping_base, base)}{s.currency !== base ? ` (${fmtMoney(s.total_shipping_cost, s.currency)})` : ""}</span>
          <span>{t("sh_customsCost")}</span><span className="text-end font-medium" dir="ltr">{fmtMoney(s.customs_base, base)}{s.customs_currency !== base ? ` (${fmtMoney(s.customs_cost, s.customs_currency)})` : ""}</span>
          <span>{t("sh_costPerKg")}</span><span className="text-end font-medium" dir="ltr">{fmtMoney(alloc.costPerKg, base)}</span>
          <span>{t("sh_landedTotal")}</span><span className="text-end font-medium" dir="ltr">{pending ? t("sh_costPending") : fmtMoney(landedTotal, base)}</span>
        </div>
        {!compact && (
          <ul className="space-y-1 text-sm">
            {items.map((i: any, n: number) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <ProductThumbnail url={i.products?.image_url} name={i.products?.name} />
                  <span className="truncate">{i.products?.sku} · {i.products?.name} × {i.quantity}</span>
                </span>
                <span className="shrink-0 text-end text-xs text-muted-foreground" dir="ltr">
                  {i.batch_code ? `${i.batch_code} · ${i.first_serial}…${i.last_serial}` : alloc.lines[n]?.landedUnit === null ? t("sh_costPending") : fmtMoney(alloc.lines[n]?.landedUnit, base)}
                </span>
              </li>
            ))}
            {!items.length && <li className="text-muted-foreground">{t("none")}</li>}
          </ul>
        )}
        {compact && (
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {items.slice(0, 5).map((i: any) => (
              <ProductThumbnail key={i.id} url={i.products?.image_url} name={i.products?.name} />
            ))}
          </div>
        )}
        {!s.profit_split && <p className="flex items-center gap-1 text-xs text-warning-foreground"><AlertTriangle className="size-3.5" /> {t("sh_splitMissing")}</p>}
        {!compact && (
          <p className="text-xs text-muted-foreground">
            {Object.entries(s.status_dates ?? {}).map(([k, v]) => `${ts(k)}: ${formatDate(String(v))}`).join(" · ")}
          </p>
        )}
        {editable(s) ? (
          <div className="mt-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openEdit(s)}>{t("edit")}</Button>
            {next && next !== "added_to_inventory" && (
              <Button variant="outline" size="sm" disabled={stageM.isPending} onClick={() => stageM.mutate({ s, next })}>
                {ts(next)}
              </Button>
            )}
            <Button size="sm" disabled={receiveM.isPending} onClick={() => setToReceive(s)}>{t("addToInventory")}</Button>
            <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => setToDelete(s)}><Trash2 className="size-4" /></Button>
          </div>
        ) : (
          <div className="mt-auto space-y-2">
            <p className="flex items-start gap-1 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" /> {t("sh_locked")}</p>
            <Button variant="outline" size="sm" disabled={undoM.isPending} onClick={() => setToUndo(s)}>{t("sh_undo")}</Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("shippingTitle")}
        description={t("shippingSubtitle")}
        action={
          <Button onClick={() => { reset(); setOpen(true); }}>
            <Plus className="size-4" /> {t("newShipment")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-full sm:w-64" placeholder={t("sh_search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label={t("sh_stage")} className="h-9 rounded-md border bg-background px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t("sh_all")}</option>
          {SHIPMENT_STAGES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
        </select>
        <div className="ms-auto flex gap-1">
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}><List className="size-4" /> {t("sh_list")}</Button>
          <Button size="sm" variant={view === "kanban" ? "default" : "outline"} onClick={() => setView("kanban")}><LayoutGrid className="size-4" /> {t("sh_kanban")}</Button>
        </div>
      </div>

      {view === "list" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s: any) => card(s))}
          {!visible.length && <div className="card-surface col-span-full p-10 text-center text-muted-foreground">{t("none")}</div>}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {SHIPMENT_STAGES.filter((st) => filter === "all" || st === filter).map((st) => {
            const col = visible.filter((s: any) => s.status === st);
            return (
              <div key={st} className="w-72 shrink-0 space-y-3">
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium">
                  <span>{ts(st)}</span><span className="text-muted-foreground">{col.length}</span>
                </div>
                {col.map((s: any) => card(s, true))}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("sh_editShipment") : t("newShipment")}</DialogTitle>
          </DialogHeader>
          <form
            key={formKey}
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              saveM.mutate(String(new FormData(e.currentTarget).get("receipt_path") ?? ""));
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="sh-ref">{t("reference")}</Label>
                <Input id="sh-ref" required value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sh-sender">{t("sh_sender")}</Label>
                <select id="sh-sender" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={sender} onChange={(e) => setSender(e.target.value)}>
                  <option value="">{t("sh_senderNone")}</option>
                  <optgroup label={t("sh_partnerGroup")}>
                    {partners.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
                  </optgroup>
                  <optgroup label={t("sh_supplierGroup")}>
                    {(suppliersQ.data ?? []).map((p) => <option key={p.id} value={`s:${p.id}`}>{p.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sh-stage">{t("sh_stage")}</Label>
                <select
                  id="sh-stage"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setDates((d) => ({ ...d, [e.target.value]: d[e.target.value] ?? today() }));
                  }}
                >
                  {SHIPMENT_STAGES.filter((s) => s !== "added_to_inventory").map((s) => <option key={s} value={s}>{ts(s)}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("sh_stageDates")}</Label>
              <div className="grid gap-2 sm:grid-cols-5">
                {SHIPMENT_STAGES.filter((s) => s !== "added_to_inventory").map((s) => (
                  <div key={s} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{ts(s)}</span>
                    <Input type="date" value={dates[s] ?? ""} onChange={(e) => setDates((d) => { const n = { ...d }; if (e.target.value) n[s] = e.target.value; else delete n[s]; return n; })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {costBlock(t("sh_shippingCost"), ship, setShip, "sh-ship")}
              {costBlock(t("sh_customsCost"), cust, setCust, "sh-cust")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sh-cdate">{t("sh_costDate")}</Label>
                <Input id="sh-cdate" type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} />
              </div>
              <p className="self-end text-xs text-muted-foreground">{t("sh_partnerPayerNote")}</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{t("sh_lines")}</Label>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {preview.totalWeight.toFixed(3)} {kg} · {fmtMoney(preview.costPerKg, base)} / {kg}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, { product_id: "", quantity: "1", grams: "0", cost: "" }])}>
                  <Plus className="size-4" /> {t("sh_addLine")}
                </Button>
                <Button type="button" size="sm" onClick={() => { setMany({}); setManyOpen(true); }}>
                  <Plus className="size-4" /> {t("sh_addMany")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("sh_costPendingHint")} {t("sh_marginEditHint")}</p>
              {lines.map((l, idx) => {
                const p = products.find((x) => x.id === l.product_id);
                const a = preview.lines[idx];
                const unitG = num(l.grams);
                const sale = num(p?.sale_price);
                const margin = a?.landedUnit !== null && a && sale > 0 ? ((sale - a.landedUnit) / sale) * 100 : null;
                const threshold = num(p?.margin_alert_threshold);
                const upd = (patch: Partial<Line>) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
                return (
                  <div key={idx} className="space-y-2 rounded-lg border p-3">
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.4fr_auto]">
                      <div className="flex min-w-0 items-center gap-2">
                        <ProductThumbnail url={p?.image_url ?? null} name={p?.name ?? null} />
                        <select
                          aria-label={t("product")}
                          className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
                          value={l.product_id}
                          onChange={(e) => {
                            const np = products.find((x) => x.id === e.target.value);
                            upd({ product_id: e.target.value, grams: String(num(np?.weight_grams)) });
                          }}
                        >
                          <option value="">{t("product")}</option>
                          {products.map((x) => <option key={x.id} value={x.id}>{x.sku} — {x.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">{t("sh_qty")}</span>
                        <Input type="number" min="1" step="1" value={l.quantity} onChange={(e) => upd({ quantity: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">{t("sh_unitGrams")}</span>
                        <Input type="number" min="0" step="0.01" value={l.grams} onChange={(e) => upd({ grams: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">{t("sh_itemCost")} ({base})</span>
                        <Input type="number" min="0" step="0.01" placeholder={t("sh_costPending")} value={l.cost} onChange={(e) => upd({ cost: e.target.value })} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="self-end" aria-label={t("delete")} onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <span>{t("sh_lineWeight")}: <b dir="ltr">{((num(l.quantity) * unitG) / 1000).toFixed(3)} {kg}</b></span>
                      <span>{t("sh_weightShare")}: <b dir="ltr">{formatPercent(a?.weightShare ?? 0)}</b></span>
                      <span>{t("sh_shipUnit")}: <b dir="ltr">{fmtMoney(a?.shipUnit ?? 0, base)}</b></span>
                      <span>{t("sh_custUnit")}: <b dir="ltr">{fmtMoney(a?.custUnit ?? 0, base)}</b></span>
                      <span>{t("sh_landedUnit")}: <b dir="ltr">{a?.landedUnit === null || !a ? t("sh_costPending") : fmtMoney(a.landedUnit, base)}</b></span>
                      <span>{t("sh_costPerGram")}: <b dir="ltr">{a?.landedUnit != null && unitG > 0 ? fmtMoney(a.landedUnit / unitG, base) : "—"}</b></span>
                      <span>{t("sh_salePrice")}: <b dir="ltr">{fmtMoney(sale, base)}</b></span>
                      <span className={margin !== null && margin < threshold ? "font-medium text-destructive" : ""}>
                        {t("sh_margin")}: <b dir="ltr">{formatPercent(margin)}</b> ({t("sh_threshold")} <span dir="ltr">{formatPercent(threshold)}</span>)
                        {margin !== null && margin < threshold ? ` · ${t("sh_marginAlert")}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{t("sh_profitSplit")}</p>
              <p className="text-xs text-muted-foreground">{t("sh_splitHint")}</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {partners.filter((p) => p.active !== false).map((p) => (
                  <div key={p.id} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{p.name} %</span>
                    <Input type="number" min="0" max="100" step="0.01" value={split[p.id] ?? ""} onChange={(e) => setSplit((s) => ({ ...s, [p.id]: e.target.value }))} />
                  </div>
                ))}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("sh_costOwedTo")}</span>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={owedTo} onChange={(e) => setOwedTo(e.target.value)}>
                    <option value="">{t("sh_senderNone")}</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <p className={`text-xs ${splitFilled && Math.abs(splitTotal - 100) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}>
                {t("sh_splitTotal")}: <span dir="ltr">{formatPercent(splitTotal, 2)}</span>
              </p>
            </div>

            <ReceiptUpload idPrefix="sh" defaultPath={receipt} />
            <div className="space-y-1">
              <Label htmlFor="sh-notes">{t("notes")}</Label>
              <Textarea id="sh-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={saveM.isPending}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        description={t("sh_deleteBody")}
        onConfirm={() => { if (toDelete) deleteM.mutate(toDelete.id); setToDelete(null); }}
      />

      <AlertDialog open={!!toUndo} onOpenChange={(v) => !v && setToUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sh_undo")} · {toUndo?.reference}</AlertDialogTitle>
            <AlertDialogDescription>{t("sh_undoBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toUndo) undoM.mutate(toUndo.id); setToUndo(null); }}>{t("sh_undo")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={manyOpen} onOpenChange={setManyOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("sh_addMany")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t("sh_addManyHint")}</p>
          <ul className="space-y-1">
            {products.map((p: any) => {
              const on = many[p.id] !== undefined;
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-md border p-2">
                  <input
                    type="checkbox"
                    aria-label={p.name}
                    checked={on}
                    onChange={(e) => setMany((m) => { const n = { ...m }; if (e.target.checked) n[p.id] = "1"; else delete n[p.id]; return n; })}
                  />
                  <ProductThumbnail url={p.image_url ?? null} name={p.name ?? null} />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.sku} — {p.name}</span>
                  {on && (
                    <Input aria-label={t("sh_qty")} className="w-20" type="number" min="1" step="1" value={many[p.id]} onChange={(e) => setMany((m) => ({ ...m, [p.id]: e.target.value }))} />
                  )}
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManyOpen(false)}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={!Object.keys(many).length}
              onClick={() => {
                setLines((prev) => {
                  const next = [...prev];
                  for (const [id, q] of Object.entries(many)) {
                    const p: any = products.find((x: any) => x.id === id);
                    const ex = next.findIndex((l) => l.product_id === id);
                    if (ex >= 0) { const cur = next[ex]!; next[ex] = { ...cur, quantity: String(num(cur.quantity) + Math.max(1, num(q))) }; }
                    else next.push({ product_id: id, quantity: String(Math.max(1, num(q))), grams: String(num(p?.weight_grams)), cost: "" });
                  }
                  return next;
                });
                setMany({});
                setManyOpen(false);
              }}
            >
              {t("sh_addSelected")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!toReceive} onOpenChange={(v) => !v && setToReceive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sh_confirmAdd")}</AlertDialogTitle>
            <AlertDialogDescription>{t("sh_confirmAddBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {toReceive && !toReceive.profit_split && (
            <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/15 p-3 text-sm"><AlertTriangle className="size-4 shrink-0" /> {t("sh_splitMissingConfirm")}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toReceive) receiveM.mutate(toReceive); setToReceive(null); }}>
              {toReceive && !toReceive.profit_split ? t("sh_addAnyway") : t("addToInventory")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!result} onOpenChange={(v) => !v && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sh_receiptResult")} · {result?.reference}</DialogTitle>
          </DialogHeader>
          {result?.split_missing && <p className="flex gap-2 text-sm text-warning-foreground"><AlertTriangle className="size-4" /> {t("sh_splitMissing")}</p>}
          <ul className="space-y-2 text-sm">
            {(result?.lines ?? []).map((l: any) => {
              const p = products.find((x) => x.id === l.product_id);
              return (
                <li key={l.batch_id} className="flex items-center gap-2 rounded-md border p-2">
                  <ProductThumbnail url={p?.image_url ?? null} name={p?.name ?? null} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p?.name ?? l.product_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("sh_batch")}: <span dir="ltr">{l.batch_code}</span> · {t("sh_serials")}: <span dir="ltr">{l.first_serial} → {l.last_serial}</span> ({l.quantity})
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <DialogFooter><Button onClick={() => setResult(null)}>{t("sh_ok")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
