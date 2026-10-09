import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n , tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORDER_STATUSES, PLATFORMS, formatDate, money, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Khoyoot" },
      { name: "description", content: "Manual order entry, order status and margin per order." },
      { property: "og:title", content: "Orders — Khoyoot" },
      { property: "og:description", content: "Manual order entry, order status and margin per order." },
    ],
  }),
  component: OrdersPage,
});

type Line = { product_id: string; quantity: number; sale_price: number };

function OrdersPage() {
  const roles = useRoles();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: 1, sale_price: 0 }]);

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, sale_price, avg_cost, cost_price")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name, sku))")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { data: order, error } = await supabase
        .from("orders")
        .insert(payload.order)
        .select("id")
        .single();
      if (error) throw error;
      const items = payload.lines.map((l: Line) => {
        const p = (productsQ.data ?? []).find((x: any) => x.id === l.product_id);
        return {
          order_id: order.id,
          product_id: l.product_id,
          quantity: l.quantity,
          sale_price: l.sale_price,
          unit_cost: Number(p?.avg_cost ?? p?.cost_price ?? 0),
        };
      });
      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) throw itemsError;

      for (const l of payload.lines) {
        await supabase.rpc("adjust_stock", {
          _product_id: l.product_id,
          _change: -Math.abs(l.quantity),
          _reason: "sale",
          _note: "tt("Order fulfilment")",
        });
      }
    },
    onSuccess: () => {
      toast.success(tt("Order saved"));
      setOpen(false);
      setLines([{ product_id: "", quantity: 1, sale_price: 0 }]);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: v.status }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isOperations) {
    return <AccessDenied message={tt("Orders are available to the Owner and the Operations partner.")} />;
  }

  const products = (productsQ.data ?? []) as any[];
  const orders = (ordersQ.data ?? []) as any[];
  const totalOf = (o: any) =>
    o.order_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.sale_price), 0);
  const costOf = (o: any) =>
    o.order_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_cost), 0);

  return (
    <div>
      <PageHeader
        title={t("orders")}
        description={t("ordersSubtitle")}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> {t("newOrder")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{tt("New order")}</DialogTitle>
                <DialogDescription>{tt("Stock is deducted automatically for each line.")}</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  const valid = lines.filter((l) => l.product_id && l.quantity > 0);
                  if (!valid.length) {
                    toast.error(tt("Add at least one product"));
                    return;
                  }
                  create.mutate({
                    order: {
                      order_number: (f.get("order_number") as string) || null,
                      order_date: String(f.get("order_date")),
                      platform: String(f.get("platform")),
                      status: String(f.get("status")),
                      customer_name: (f.get("customer_name") as string) || null,
                      shipping_cost: Number(f.get("shipping_cost") || 0),
                      platform_fee: Number(f.get("platform_fee") || 0),
                      notes: (f.get("notes") as string) || null,
                    },
                    lines: valid,
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{tt("Date")}</Label>
                    <Input name="order_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Platform")}</Label>
                    <Select name="platform" defaultValue="Manual">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Order ref")}</Label>
                    <Input name="order_number" placeholder={tt("Optional")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Status")}</Label>
                    <Select name="status" defaultValue="pending">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {titleCase(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tt("Customer")}</Label>
                  <Input name="customer_name" dir="auto" />
                </div>

                <div className="space-y-2">
                  <Label>{tt("Products")}</Label>
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_70px_90px] gap-2">
                      <Select
                        value={line.product_id}
                        onValueChange={(v) => {
                          const p = products.find((x) => x.id === v);
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, product_id: v, sale_price: Number(p?.sale_price ?? 0) } : l,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tt("Product")} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} · {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) } : l)),
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={line.sale_price}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, sale_price: Number(e.target.value) } : l)),
                          )
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLines((p) => [...p, { product_id: "", quantity: 1, sale_price: 0 }])}
                  >
                    {tt("Add line")}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{tt("Shipping cost")}</Label>
                    <Input name="shipping_cost" type="number" step="0.01" defaultValue={0} />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Platform fee")}</Label>
                    <Input name="platform_fee" type="number" step="0.01" defaultValue={0} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tt("Notes")}</Label>
                  <Textarea name="notes" rows={2} dir="auto" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Saving…" : "Save order"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{tt("Date")}</th>
              <th className="px-4 py-3">{tt("Platform")}</th>
              <th className="px-4 py-3">{tt("Items")}</th>
              <th className="px-4 py-3">{tt("Total")}</th>
              {roles.isOwner && <th className="px-4 py-3">{tt("Margin")}</th>}
              <th className="px-4 py-3">{tt("Status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3">{formatDate(o.order_date)}</td>
                <td className="px-4 py-3">{o.platform}</td>
                <td className="px-4 py-3">
                  {o.order_items.reduce((s: number, i: any) => s + Number(i.quantity), 0)} {tt("pcs")}
                </td>
                <td className="px-4 py-3">{money(totalOf(o))}</td>
                {roles.isOwner && (
                  <td className="px-4 py-3 font-medium">
                    {money(totalOf(o) - costOf(o) - Number(o.platform_fee) - Number(o.shipping_cost))}
                  </td>
                )}
                <td className="px-4 py-3">
                  <Select value={o.status} onValueChange={(v) => setStatus.mutate({ id: o.id, status: v })}>
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {titleCase(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(o)}>
                    {tt("View")}
                  </Button>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {tt("No orders yet.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt("Order detail")}</DialogTitle>
            <DialogDescription>
              {detail && `${formatDate(detail.order_date)} · ${detail.platform}`}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {detail.order_items.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{i.products?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.quantity} × {money(i.sale_price)}
                      {roles.isOwner && ` · cost ${money(i.unit_cost)}`}
                    </p>
                  </div>
                  {roles.isOwner && (
                    <Badge variant="secondary">
                      {money(Number(i.quantity) * (Number(i.sale_price) - Number(i.unit_cost)))} {tt("margin")}
                    </Badge>
                  )}
                </div>
              ))}
              <div className="flex justify-between border-t pt-3">
                <span>{tt("Order total")}</span>
                <span className="font-medium">{money(totalOf(detail))}</span>
              </div>
              {roles.isOwner && (
                <>
                  <div className="flex justify-between">
                    <span>{tt("Product cost")}</span>
                    <span>{money(costOf(detail))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tt("Shipping + platform fee")}</span>
                    <span>{money(Number(detail.shipping_cost) + Number(detail.platform_fee))}</span>
                  </div>
                  <div className="flex justify-between font-display text-lg">
                    <span>{tt("Net margin")}</span>
                    <span>
                      {money(
                        totalOf(detail) - costOf(detail) - Number(detail.shipping_cost) - Number(detail.platform_fee),
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
