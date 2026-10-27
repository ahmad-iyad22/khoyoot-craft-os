import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n, tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { OrderImport } from "@/components/order-import";
import { TatreezEmptyState } from "@/components/tatreez";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORDER_STATUSES, formatDate, money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Khoyoot" },
      { name: "description", content: "Order entry with batch allocation, platform fees and profit per partner." },
      { property: "og:title", content: "Orders — Khoyoot" },
      { property: "og:description", content: "Order entry with batch allocation, platform fees and profit per partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

type Split = { partner_id: string; percent: number }[];
type FormLine = { product_id: string; quantity: number; sale_price: number; serials: string };
type Partner = { id: string; name: string };

const num = (v: unknown) => Number(v ?? 0) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const splitValid = (s: unknown): s is Split =>
  Array.isArray(s) && s.length > 0 && Math.abs(s.reduce((a, x: any) => a + num(x.percent), 0) - 100) < 0.0001;

function errText(e: Error, t: (k: string) => string) {
  const m = /INSUFFICIENT_STOCK: (\S+) \(available (-?\d+)\)/.exec(e.message);
  if (m) return t("notEnoughStock").replace("{sku}", m[1]!).replace("{n}", m[2]!);
  if (e.message.includes("ORDER_HAS_RETURNS")) return t("ord_hasReturns");
  if (e.message.includes("SERIAL_COUNT_MISMATCH")) return t("ord_serialMismatch");
  if (e.message.includes("SERIAL_NOT_AVAILABLE")) return t("ord_serialNotAvail");
  if (e.message.includes("SPLIT_NOT_100")) return t("ord_splitTotal").replace("{n}", "≠100");
  const r = /RETURN_QTY_INVALID: (\d+)/.exec(e.message);
  if (r) return t("ord_returnQtyInvalid").replace("{n}", r[1]!);
  return e.message;
}

function usePartners() {
  return useQuery({
    queryKey: ["partners-basic"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await supabase.from("partners").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function SplitShares({ split, profit, partners }: { split: unknown; profit: number; partners: Partner[] }) {
  const { t } = useI18n();
  if (!splitValid(split))
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="size-3.5" /> {t("ord_splitMissing")} · {t("ord_unallocated")} {money(profit)}
      </span>
    );
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {split.map((s) => (
        <span key={s.partner_id}>
          {partners.find((p) => p.id === s.partner_id)?.name ?? "—"} {num(s.percent)}%: <b className="text-foreground">{money(r2((profit * num(s.percent)) / 100))}</b>
        </span>
      ))}
    </span>
  );
}

function OrdersPage() {
  const roles = useRoles();
  const { t, ts } = useI18n();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const partnersQ = usePartners();
  const partners = partnersQ.data ?? [];

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name, sku, image_url)), order_returns(*)")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const profitQ = useQuery({
    queryKey: ["order-line-profit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_line_profit" as never).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const settingsQ = useQuery({
    queryKey: ["app-settings-counting"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("id, counting_statuses").maybeSingle();
      if (error) throw error;
      return data as { id: boolean; counting_statuses: string[] } | null;
    },
  });
  const counting = settingsQ.data?.counting_statuses ?? ["delivered", "completed"];

  const saveCounting = useMutation({
    mutationFn: async (list: string[]) => {
      const { error } = await supabase.from("app_settings").update({ counting_statuses: list } as never).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("ord_settingsSaved"));
      qc.invalidateQueries({ queryKey: ["app-settings-counting"] });
    },
    onError: (e: Error) => toast.error(errText(e, t)),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_order_status" as never, { _id: v.id, _status: v.status } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("ord_statusSaved"));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(errText(e, t)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_order" as never, { _id: id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("ord_deleted"));
      setToDelete(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(errText(e, t)),
  });

  if (!roles.isLoading && !roles.isOperations) return <AccessDenied message={tt("ord_onlyOps")} />;

  const orders = (ordersQ.data ?? []) as any[];
  const lines = profitQ.data ?? [];
  const totalOf = (o: any) => o.order_items.reduce((s: number, i: any) => s + num(i.quantity) * num(i.sale_price), 0);
  const profitOf = (id: string) => lines.filter((l) => l.order_id === id).reduce((s, l) => s + num(l.profit), 0);
  const missingOf = (id: string) => lines.some((l) => l.order_id === id && l.split_missing);
  const platLabel = (p: string) => (p === "Manual" ? t("ord_Manual") : p);
  const detail = orders.find((o) => o.id === detailId) ?? null;

  return (
    <div>
      <PageHeader
        title={t("orders")}
        description={t("ordersSubtitle")}
        action={
          <div className="flex flex-wrap gap-2">
          {roles.isOwner && <OrderImport />}
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="size-4" /> {t("ord_newOrder")}
          </Button>
          </div>
        }
      />

      {roles.isOwner && (
        <div className="card-surface mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="text-muted-foreground">{t("ord_countingStatuses")}:</span>
          {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <Checkbox
                checked={counting.includes(s)}
                onCheckedChange={(v) => {
                  const next = v ? [...counting, s] : counting.filter((x) => x !== s);
                  saveCounting.mutate(Array.from(new Set(next)));
                }}
              />
              {ts(s)}
            </label>
          ))}
        </div>
      )}

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("date")}</th>
              <th className="px-4 py-3 text-start">{t("ord_platform")}</th>
              <th className="px-4 py-3 text-start">{t("ord_items")}</th>
              <th className="px-4 py-3 text-start">{t("ord_total")}</th>
              <th className="px-4 py-3 text-start">{t("ord_profit")}</th>
              <th className="px-4 py-3 text-start">{t("ord_status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3">
                  {formatDate(o.order_date)}
                  {o.order_number && <div className="text-xs text-muted-foreground">{o.order_number}</div>}
                </td>
                <td className="px-4 py-3">{platLabel(o.platform)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {o.order_items.slice(0, 2).map((i: any) => (
                      <ProductThumbnail key={i.id} url={i.products?.image_url} name={i.products?.name} />
                    ))}
                    <span>{o.order_items.reduce((s: number, i: any) => s + num(i.quantity), 0)} {t("ord_pcs")}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{money(totalOf(o))}</td>
                <td className="px-4 py-3">
                  {o.status === "cancelled" ? "—" : <span className="font-medium">{money(profitOf(o.id))}</span>}
                  {missingOf(o.id) && (
                    <div className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> {t("ord_splitMissing")}</div>
                  )}
                  {o.status !== "cancelled" && !counting.includes(o.status) && (
                    <div className="text-xs text-muted-foreground">{t("ord_notCounted")}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select value={o.status} onValueChange={(v) => setStatus.mutate({ id: o.id, status: v })}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetailId(o.id)}>{t("ord_view")}</Button>
                    <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => {
                      if (o.order_returns?.length) { toast.error(tt("ord_hasReturns")); return; }
                      setEditing(o); setFormOpen(true);
                    }}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => {
                      if (o.order_returns?.length) { toast.error(tt("ord_hasReturns")); return; }
                      setToDelete(o);
                    }}><Trash2 className="size-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground"><TatreezEmptyState title={t("ord_none")} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <OrderForm
          key={editing?.id ?? "new"}
          order={editing}
          partners={partners}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        description={t("ord_deleteBody")}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("ord_detail")}</DialogTitle>
            <DialogDescription>{detail && `${formatDate(detail.order_date)} · ${platLabel(detail.platform)} · ${ts(detail.status)}`}</DialogDescription>
          </DialogHeader>
          {detail && <OrderDetail order={detail} lines={lines.filter((l) => l.order_id === detail.id)} partners={partners} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDetail({ order, lines, partners }: { order: any; lines: any[]; partners: Partner[] }) {
  const { t, ts } = useI18n();
  const [returnFor, setReturnFor] = useState<any | null>(null);
  const total = order.order_items.reduce((s: number, i: any) => s + num(i.quantity) * num(i.sale_price), 0);
  const profit = lines.reduce((s, l) => s + num(l.profit), 0);
  const owed = new Map<string, number>();
  for (const l of lines) if (l.cost_owed_partner_id) owed.set(l.cost_owed_partner_id, (owed.get(l.cost_owed_partner_id) ?? 0) + num(l.item_cost_owed));
  return (
    <div className="space-y-3 text-sm">
      {order.order_items.map((i: any) => {
        const ls = lines.filter((l) => l.order_item_id === i.id);
        const left = ls.reduce((s, l) => s + num(l.quantity) - num(l.returned_qty), 0);
        return (
          <div key={i.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <ProductThumbnail url={i.products?.image_url} name={i.products?.name} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.products?.name}</p>
                  <p className="text-xs text-muted-foreground">{i.quantity} × {money(i.sale_price)}</p>
                </div>
              </div>
              {order.status !== "cancelled" && left > 0 && (
                <Button size="sm" variant="outline" onClick={() => setReturnFor({ item: i, max: left })}>
                  <RotateCcw className="size-3.5" /> {t("ord_return")}
                </Button>
              )}
            </div>
            {ls.map((l) => (
              <div key={l.allocation_id} className="space-y-1 rounded-md bg-muted/40 p-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{t("ord_batch")}: <b>{l.batch_code ?? t("ord_noBatch")}</b> · {l.quantity} {t("ord_pcs")}{num(l.returned_qty) > 0 && ` · ${t("ord_returned")} ${l.returned_qty}`}</span>
                  <span>{t("ord_profit")}: <b>{money(l.profit)}</b></span>
                </div>
                {l.serials?.length > 0 && <p className="font-mono text-muted-foreground" dir="ltr">{l.serials.join(", ")}</p>}
                <p className="text-muted-foreground">
                  {t("ord_landed")} {money(l.landed_cost)} · {t("ord_platformFee")} {money(l.platform_fee_share)} · {t("ord_shipTax")} {money(l.shipping_tax_share)} · {t("ord_packaging")} {money(l.packaging_cost)}
                </p>
                <SplitShares split={l.effective_split} profit={num(l.profit)} partners={partners} />
              </div>
            ))}
          </div>
        );
      })}
      <div className="space-y-1 border-t pt-3">
        <div className="flex justify-between"><span>{t("ord_total")}</span><span>{money(total)}</span></div>
        <div className="flex justify-between"><span>{t("ord_platformFee")}</span><span>{money(order.platform_fee)}</span></div>
        <div className="flex justify-between"><span>{t("ord_shipTax")}</span><span>{money(num(order.shipping_cost) + num(order.tax_amount))}</span></div>
        <div className="flex justify-between"><span>{t("ord_packaging")}</span><span>{money(order.packaging_cost)}</span></div>
        <div className="flex justify-between font-display text-lg"><span>{t("ord_profit")}</span><span>{money(profit)}</span></div>
        {[...owed].map(([pid, v]) => (
          <div key={pid} className="flex justify-between text-muted-foreground">
            <span>{t("ord_costOwed").replace("{name}", partners.find((p) => p.id === pid)?.name ?? "—")}</span><span>{money(v)}</span>
          </div>
        ))}
      </div>
      {order.order_returns?.length > 0 && (
        <div className="space-y-1 border-t pt-3">
          <p className="font-medium">{t("ord_returnsList")}</p>
          {order.order_returns.map((r: any) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              {formatDate(r.return_date)} · {r.quantity} {t("ord_pcs")} · {r.action === "restock" ? t("ord_restock") : t("ord_loss")} · {t("ord_refund")} {money(r.refund_amount)}
              {num(r.platform_fee_refunded) > 0 && ` · ${t("ord_platformFee")} ${money(r.platform_fee_refunded)}`}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{ts(order.status)}</p>
      {returnFor && <ReturnDialog item={returnFor.item} max={returnFor.max} onClose={() => setReturnFor(null)} />}
    </div>
  );
}

function ReturnDialog({ item, max, onClose }: { item: any; max: number; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [action, setAction] = useState<"restock" | "loss">("restock");
  const [refund, setRefund] = useState(String(num(item.sale_price)));
  const [refundFee, setRefundFee] = useState(false);
  const save = useMutation({
    mutationFn: async (v: { date: string; notes: string }) => {
      const { error } = await supabase.rpc("record_return" as never, {
        _item_id: item.id, _qty: qty, _action: action, _refund: Number(refund || 0), _refund_fee: refundFee, _date: v.date, _notes: v.notes,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tt("ord_returnSaved")); qc.invalidateQueries(); onClose(); },
    onError: (e: Error) => toast.error(errText(e, t)),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ord_returnTitle")}</DialogTitle>
          <DialogDescription>{item.products?.name}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save.mutate({ date: String(f.get("date")), notes: String(f.get("notes") ?? "") });
        }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("quantity")} (≤ {max})</Label>
              <Input type="number" min={1} max={max} value={qty} onChange={(e) => {
                const q = Math.max(1, Math.min(max, Number(e.target.value) || 1));
                setQty(q); setRefund(String(r2(q * num(item.sale_price))));
              }} />
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("ord_returnAction")}</Label>
            <Select value={action} onValueChange={(v) => setAction(v as "restock" | "loss")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restock">{t("ord_restock")}</SelectItem>
                <SelectItem value="loss">{t("ord_loss")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("ord_refund")}</Label>
            <Input type="number" step="0.01" min={0} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={refundFee} onCheckedChange={(v) => setRefundFee(!!v)} /> {t("ord_refundFee")}
          </label>
          <div className="space-y-2">
            <Label>{t("notes")}</Label>
            <Textarea name="notes" rows={2} dir="auto" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t("ord_saving") : t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderForm({ order, partners, onClose }: { order: any | null; partners: Partner[]; onClose: () => void }) {
  const { t, ts } = useI18n();
  const qc = useQueryClient();
  const productsQ = useQuery({
    queryKey: ["order-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, image_url, sale_price, stock_qty, status, packaging_cost_per_unit")
        .eq("archived", false)
        .in("status", ["active", "out_of_stock"])
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const products = productsQ.data ?? [];
  const platformsQ = useQuery({
    queryKey: ["platform-fees-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_fees").select("*").order("platform");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const feeRates = platformsQ.data ?? [];
  const platforms = Array.from(new Set([...feeRates.map((x) => x.platform as string), "Manual", ...(order?.platform ? [order.platform] : [])]));
  // Mirrors the database compute_platform_fee formula: (amount x (commission% [0 while waived] + transaction%) / 100 + fixed) x (1 + sst%).
  const feeFor = (pf: any, amount: number) => {
    if (amount <= 0) return 0;
    const waived = pf.waiver_until && date <= pf.waiver_until;
    const comm = waived ? 0 : num(pf.commission_percent);
    return r2((amount * (comm + num(pf.transaction_fee_percent)) / 100 + num(pf.fixed_fee)) * (1 + num(pf.sst_percent) / 100));
  };
  const inOrder = useMemo(() => {
    const m = new Map<string, number>();
    if (order && order.status !== "cancelled") for (const i of order.order_items) m.set(i.product_id, (m.get(i.product_id) ?? 0) + num(i.quantity));
    return m;
  }, [order]);
  const availOf = (pid: string) => num(products.find((p) => p.id === pid)?.stock_qty) + (inOrder.get(pid) ?? 0);

  const [date, setDate] = useState<string>(order?.order_date ?? new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<string>(order?.platform ?? "Manual");
  const [status, setStatusV] = useState<string>(order?.status ?? "pending");
  const [ref, setRef] = useState<string>(order?.order_number ?? "");
  const [customer, setCustomer] = useState<string>(order?.customer_name ?? "");
  const [ship, setShip] = useState<string>(String(order?.shipping_cost ?? 0));
  const [tax, setTax] = useState<string>(String(order?.tax_amount ?? 0));
  const [feeManual, setFeeManual] = useState<boolean>(!!order?.platform_fee_manual);
  const [feeValue, setFeeValue] = useState<string>(String(order?.platform_fee ?? 0));
  const [notes, setNotes] = useState<string>(order?.notes ?? "");
  const initSplit: Record<string, string> = {};
  if (Array.isArray(order?.split_override)) for (const s of order.split_override) initSplit[s.partner_id] = String(s.percent);
  const [useOverride, setUseOverride] = useState<boolean>(splitValid(order?.split_override));
  const [split, setSplit] = useState<Record<string, string>>(initSplit);
  const [lines, setLines] = useState<FormLine[]>(
    order?.order_items?.length
      ? order.order_items.map((i: any) => ({ product_id: i.product_id ?? "", quantity: num(i.quantity), sale_price: num(i.sale_price), serials: "" }))
      : [{ product_id: "", quantity: 1, sale_price: 0, serials: "" }],
  );

  const revenue = lines.reduce((s, l) => s + (l.product_id ? l.quantity * l.sale_price : 0), 0);
  const feeQ = useQuery({
    queryKey: ["fee-preview", platform, revenue, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compute_platform_fee" as never, { _platform: platform, _revenue: revenue, _date: date } as never);
      if (error) throw error;
      return data as unknown as { amount: number; snapshot: any };
    },
  });
  const autoFee = num(feeQ.data?.amount);
  const fee = feeManual ? num(feeValue) : autoFee;

  const parseSerials = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const allocQs = useQueries({
    queries: lines.map((l) => ({
      queryKey: ["alloc-preview", l.product_id, l.quantity, l.serials],
      enabled: !!l.product_id && l.quantity > 0,
      queryFn: async () => {
        const sers = parseSerials(l.serials);
        const { data, error } = await supabase.rpc("preview_allocation" as never, {
          _product_id: l.product_id, _qty: l.quantity, _serials: sers.length ? sers : null,
        } as never);
        if (error) throw error;
        return (data ?? []) as any[];
      },
    })),
  });

  const overrideSplit: Split = partners.filter((p) => split[p.id] !== undefined && split[p.id] !== "").map((p) => ({ partner_id: p.id, percent: num(split[p.id]) }));
  const overrideTotal = overrideSplit.reduce((s, x) => s + x.percent, 0);
  const otherCosts = num(ship) + num(tax);

  const preview = lines.map((l, idx) => {
    const p = products.find((x) => x.id === l.product_id);
    const pack = num(p?.packaging_cost_per_unit);
    const allocs = (allocQs[idx]?.data ?? []) as any[];
    return allocs.map((a) => {
      const q = num(a.quantity);
      const rev = q * l.sale_price;
      const share = revenue > 0 ? rev / revenue : 0;
      const profit = r2(rev - q * num(a.unit_landed_cost) - fee * share - otherCosts * share - q * pack);
      return { ...a, profit, split: useOverride && splitValid(overrideSplit) ? overrideSplit : a.profit_split };
    });
  });
  const previewProfit = preview.flat().reduce((s, a) => s + a.profit, 0);

  const save = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((l) => l.product_id && l.quantity > 0);
      if (!valid.length) throw new Error(tt("ord_addOne"));
      const totals = new Map<string, number>();
      for (const l of valid) totals.set(l.product_id, (totals.get(l.product_id) ?? 0) + l.quantity);
      for (const [pid, q] of totals) {
        if (q > availOf(pid)) {
          const p = products.find((x) => x.id === pid);
          throw new Error(`INSUFFICIENT_STOCK: ${p?.sku ?? ""} (available ${availOf(pid)})`);
        }
      }
      for (const l of valid) {
        const s = parseSerials(l.serials);
        if (s.length && s.length !== l.quantity) throw new Error("SERIAL_COUNT_MISMATCH");
      }
      if (useOverride && Math.abs(overrideTotal - 100) > 0.0001) throw new Error("SPLIT_NOT_100");
      const payload = {
        order_number: ref, order_date: date, platform, status, customer_name: customer,
        shipping_cost: num(ship), tax_amount: num(tax), platform_fee_manual: feeManual, platform_fee: num(feeValue), notes,
        split_override: useOverride ? overrideSplit : null,
      };
      const linesPayload = valid.map((l) => ({ product_id: l.product_id, quantity: l.quantity, sale_price: l.sale_price, serials: parseSerials(l.serials) }));
      const { error } = order
        ? await supabase.rpc("update_order" as never, { _id: order.id, _order: payload, _lines: linesPayload } as never)
        : await supabase.rpc("create_order", { _order: payload, _lines: linesPayload } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tt("ord_saved")); qc.invalidateQueries(); onClose(); },
    onError: (e: Error) => toast.error(errText(e, t)),
  });

  const snap = feeQ.data?.snapshot;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{order ? t("ord_editOrder") : t("ord_newOrder")}</DialogTitle>
          <DialogDescription>{order ? t("ord_editHint") : t("ord_formHint")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("ord_platform")}</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p} value={p}>{p === "Manual" ? t("ord_Manual") : p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("ord_ref")}</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("ord_optional")} />
            </div>
            <div className="space-y-2">
              <Label>{t("ord_status")}</Label>
              <Select value={status} onValueChange={setStatusV}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("ord_customer")}</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} dir="auto" />
          </div>

          <div className="space-y-3">
            <Label>{t("products")}</Label>
            {lines.map((line, idx) => {
              const p = products.find((x) => x.id === line.product_id);
              const allocs = preview[idx] ?? [];
              const over = !!line.product_id && line.quantity > availOf(line.product_id);
              return (
                <div key={idx} className="space-y-2 rounded-lg border p-2">
                  <div className="grid grid-cols-[1fr_64px_90px_32px] gap-2">
                    <Select value={line.product_id} onValueChange={(v) => {
                      const np = products.find((x) => x.id === v);
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, product_id: v, sale_price: num(np?.sale_price), serials: "" } : l)));
                    }}>
                      <SelectTrigger><SelectValue placeholder={t("ord_product")} /></SelectTrigger>
                      <SelectContent>
                        {products.map((x) => (
                          <SelectItem key={x.id} value={x.id}>
                            <span className="flex min-w-0 items-center gap-2">
                              <ProductThumbnail url={x.image_url} name={x.name} />
                              <span className="truncate">{x.sku} · {x.name}</span>
                              <span className={"ms-auto text-xs " + (availOf(x.id) > 0 ? "text-muted-foreground" : "text-destructive")}>{t("available")}: {availOf(x.id)}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} aria-label={t("ord_qty")} aria-invalid={over} value={line.quantity}
                      onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: Math.max(0, Number(e.target.value)) } : l)))} />
                    <Input type="number" step="0.01" aria-label={t("ord_price")} value={line.sale_price}
                      onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, sale_price: Number(e.target.value) } : l)))} />
                    <Button type="button" size="icon" variant="ghost" aria-label={t("delete")} disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
                  </div>
                  {p && (
                    <>
                      <p className={"text-xs " + (over ? "text-destructive" : "text-muted-foreground")}>
                        {t("available")}: {availOf(p.id)} · {t("ord_packaging")} {money(num(p.packaging_cost_per_unit) * line.quantity)}
                      </p>
                      {line.sale_price > 0 && feeRates.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t("ord_netPerPlatform")}:{" "}
                          {feeRates.map((pf) => {
                            const net = r2(line.sale_price - feeFor(pf, line.sale_price));
                            return (
                              <span key={pf.platform} className={pf.platform === platform ? "font-semibold text-foreground" : undefined}>
                                {tt(pf.platform)} {money(net)}
                              </span>
                            );
                          }).reduce<ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, " · ", el]), [])}
                        </p>
                      )}
                      <Input value={line.serials} placeholder={t("ord_serialsManual")} dir="ltr" className="h-8 text-xs"
                        onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, serials: e.target.value } : l)))} />
                      {allocQs[idx]?.error && <p className="text-xs text-destructive">{errText(allocQs[idx]!.error as Error, t)}</p>}
                      {allocs.map((a, j) => (
                        <div key={j} className="space-y-1 rounded-md bg-muted/40 p-2 text-xs">
                          <div className="flex flex-wrap justify-between gap-2">
                            <span>{t("ord_batch")}: <b>{a.batch_code ?? t("ord_noBatch")}</b> · {a.quantity} {t("ord_pcs")} · {t("ord_landed")} {money(a.unit_landed_cost)}</span>
                            <span>{t("ord_profit")}: <b>{money(a.profit)}</b></span>
                          </div>
                          {a.serials?.length > 0 && <p className="font-mono text-muted-foreground" dir="ltr">{a.serials.join(", ")}</p>}
                          <SplitShares split={a.split} profit={a.profit} partners={partners} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, { product_id: "", quantity: 1, sale_price: 0, serials: "" }])}>
              {t("ord_addLine")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("ord_shippingCustomer")}</Label>
              <Input type="number" step="0.01" min={0} value={ship} onChange={(e) => setShip(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("ord_tax")}</Label>
              <Input type="number" step="0.01" min={0} value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("ord_platformFee")}</Label>
              <span className="font-medium">{money(fee)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("ord_feeAuto").replace("{amt}", money(autoFee))}
              {snap && ` (${num(snap.commission_percent)}% + ${num(snap.transaction_fee_percent)}% + ${money(snap.fixed_fee)}, SST ${num(snap.sst_percent)}%)`}
            </p>
            {snap?.waived && <p className="text-xs text-primary">{t("ord_feeWaived").replace("{d}", formatDate(snap.waiver_until))}</p>}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={feeManual} onCheckedChange={(v) => { setFeeManual(!!v); if (v) setFeeValue(String(autoFee)); }} /> {t("ord_feeManual")}
            </label>
            {feeManual && <Input type="number" step="0.01" min={0} value={feeValue} onChange={(e) => setFeeValue(e.target.value)} />}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={useOverride} onCheckedChange={(v) => setUseOverride(!!v)} /> {t("ord_splitOverride")}
            </label>
            {useOverride && (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {partners.map((p) => (
                    <div key={p.id} className="space-y-1">
                      <Label className="text-xs">{p.name} %</Label>
                      <Input type="number" step="0.01" min={0} max={100} value={split[p.id] ?? ""} onChange={(e) => setSplit((s) => ({ ...s, [p.id]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <p className={"text-xs " + (Math.abs(overrideTotal - 100) < 0.0001 ? "text-muted-foreground" : "text-destructive")}>
                  {t("ord_splitTotal").replace("{n}", String(r2(overrideTotal)))}
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("notes")}</Label>
            <Textarea rows={2} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <span>{t("ord_profitPreview")} · {t("ord_revenue")} {money(revenue)}</span>
            <span className="font-display text-lg">{money(previewProfit)}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? t("ord_saving") : t("ord_saveOrder")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
