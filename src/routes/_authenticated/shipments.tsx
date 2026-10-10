import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, formatDate } from "@/lib/format";
import { SHIPMENT_STAGES, allocateShipment } from "@/lib/margin";

export const Route = createFileRoute("/_authenticated/shipments")({
  head: () => ({
    meta: [
      { title: "Shipping — Khoyoot" },
      {
        name: "description",
        content: "Track Palestine to Malaysia shipments, allocate shipping cost by weight and land stock.",
      },
      { property: "og:title", content: "Shipping — Khoyoot" },
      {
        property: "og:description",
        content: "Shipment pipeline, weight-based cost allocation and weighted average landed cost.",
      },
    ],
  }),
  component: ShipmentsPage,
});

type Item = {
  id?: string;
  product_id: string;
  quantity: number;
  total_weight_kg: number;
  unit_product_cost: number;
};

function ShipmentsPage() {
  const roles = useRoles();
  const { t, ts } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const [reference, setReference] = useState("");
  const [cost, setCost] = useState("0");
  const [paidWeight, setPaidWeight] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const productsQ = useQuery({
    queryKey: ["ship-products"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, name_ar, image_url, avg_cost, sale_price, stock_qty")
        .eq("archived", false)
        .order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });

  const shipmentsQ = useQuery({
    queryKey: ["shipments"],
    enabled: roles.isOperations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, shipment_items(*, products(id, sku, name, image_url))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const preview = useMemo(
    () => allocateShipment(Number(cost || 0), items.map((i) => ({ ...i }))),
    [cost, items],
  );

  function reset() {
    setEditingId(null);
    setReference("");
    setCost("0");
    setPaidWeight("0");
    setNotes("");
    setItems([]);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setReference(s.reference ?? "");
    setCost(String(s.total_shipping_cost ?? 0));
    setPaidWeight(String(s.total_paid_weight_kg ?? 0));
    setNotes(s.notes ?? "");
    setItems(
      (s.shipment_items ?? []).map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        quantity: Number(i.quantity),
        total_weight_kg: Number(i.total_weight_kg),
        unit_product_cost: Number(i.unit_product_cost),
      })),
    );
    setOpen(true);
  }

  const saveM = useMutation({
    mutationFn: async () => {
      if (!reference.trim()) throw new Error("Reference is required");
      const payload = {
        reference: reference.trim(),
        total_shipping_cost: Number(cost || 0),
        total_paid_weight_kg: Number(paidWeight || 0),
        notes: notes || null,
      };
      let shipmentId = editingId;
      if (shipmentId) {
        const { error } = await supabase.from("shipments").update(payload).eq("id", shipmentId);
        if (error) throw error;
        await supabase.from("shipment_items").delete().eq("shipment_id", shipmentId);
      } else {
        const { data, error } = await supabase.from("shipments").insert(payload).select("id").single();
        if (error) throw error;
        shipmentId = data.id;
      }
      if (!shipmentId) throw new Error("Shipment was not saved");
      const rows = items
        .filter((i) => i.product_id)
        .map((i) => ({
          shipment_id: shipmentId,
          product_id: i.product_id,
          quantity: Number(i.quantity || 0),
          total_weight_kg: Number(i.total_weight_kg || 0),
          unit_product_cost: Number(i.unit_product_cost || 0),
        }));
      if (rows.length) {
        const { error } = await supabase.from("shipment_items").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Shipment saved");
      qc.invalidateQueries({ queryKey: ["shipments"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advanceM = useMutation({
    mutationFn: async (s: any) => {
      const idx = SHIPMENT_STAGES.indexOf(s.status);
      const next = SHIPMENT_STAGES[idx + 1];
      if (!next) throw new Error("Shipment is already complete");
      if (next === "added_to_inventory") {
        const { error } = await supabase.rpc("receive_shipment", { _shipment_id: s.id });
        if (error) throw error;
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("shipments")
        .update({
          status: next,
          status_dates: { ...(s.status_dates ?? {}), [next]: today },
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shipment updated");
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isOperations) return <AccessDenied />;

  const shipments = (shipmentsQ.data ?? []).filter((s: any) => filter === "all" || s.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("shippingTitle")}
        description={t("shippingSubtitle")}
        action={
          <Button
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> {t("newShipment")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          {t("total")}
        </Button>
        {SHIPMENT_STAGES.map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
            {ts(s)}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shipments.map((s: any) => {
          const alloc = allocateShipment(
            Number(s.total_shipping_cost),
            (s.shipment_items ?? []).map((i: any) => ({
              quantity: Number(i.quantity),
              total_weight_kg: Number(i.total_weight_kg),
              unit_product_cost: Number(i.unit_product_cost),
            })),
          );
          const idx = SHIPMENT_STAGES.indexOf(s.status);
          const next = SHIPMENT_STAGES[idx + 1];
          return (
            <div key={s.id} className="card-surface flex flex-col gap-3 p-4">
              <div className="tatreez-band h-1 w-12 rounded-full" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg">{s.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(s.total_shipping_cost)} · {Number(s.total_paid_weight_kg)} kg {t("paidWeight")}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                <div className="flex justify-between">
                  <span>{t("costPerKg")}</span>
                  <span className="font-medium">{money(alloc.costPerKg)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("weight")}</span>
                  <span className="font-medium">{alloc.totalWeight.toFixed(3)} kg</span>
                </div>
              </div>

              <ul className="space-y-1 text-sm">
                {(s.shipment_items ?? []).map((i: any, n: number) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2"><ProductThumbnail url={i.products?.image_url} name={i.products?.name} /><span className="truncate">{i.products?.sku} · {i.products?.name} × {i.quantity}</span></span>
                    <span className="shrink-0 text-muted-foreground">
                      {money(alloc.lines[n]?.landedPerUnit ?? 0)}
                    </span>
                  </li>
                ))}
                {!(s.shipment_items ?? []).length && (
                  <li className="text-muted-foreground">{t("none")}</li>
                )}
              </ul>

              <p className="text-xs text-muted-foreground">
                {Object.entries(s.status_dates ?? {})
                  .map(([k, v]) => `${ts(k)}: ${formatDate(String(v))}`)
                  .join(" · ")}
              </p>

              <div className="mt-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                  {t("edit")}
                </Button>
                {next && (
                  <Button size="sm" onClick={() => advanceM.mutate(s)} disabled={advanceM.isPending}>
                    {next === "added_to_inventory" ? t("addToInventory") : t("advanceStage")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {!shipments.length && (
          <div className="card-surface col-span-full p-10 text-center text-muted-foreground">
            {t("none")}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("edit") : t("newShipment")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label>{t("reference")}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <Label>{t("totalShippingCost")}</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <Label>{t("paidWeight")}</Label>
              <Input type="number" value={paidWeight} onChange={(e) => setPaidWeight(e.target.value)} />
            </div>
            <div>
              <Label>{t("costPerKg")}</Label>
              <Input readOnly value={preview.costPerKg.toFixed(2)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("lineItems")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { product_id: "", quantity: 1, total_weight_kg: 0, unit_product_cost: 0 },
                  ])
                }
              >
                <Plus className="size-4" /> {t("add")}
              </Button>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5">
                <div className="flex min-w-0 items-center gap-2 sm:col-span-2"><ProductThumbnail url={productsQ.data?.find((p) => p.id === it.product_id)?.image_url ?? null} />
                <select
                  className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
                  value={it.product_id}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, product_id: e.target.value } : p)),
                    )
                  }
                >
                  <option value="">{t("product")}</option>
                  {(productsQ.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select></div>
                <Input
                  type="number"
                  placeholder={t("quantity")}
                  value={it.quantity}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, quantity: Number(e.target.value) } : p)),
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.001"
                  placeholder={t("lineWeight")}
                  value={it.total_weight_kg}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, total_weight_kg: Number(e.target.value) } : p,
                      ),
                    )
                  }
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={t("unitProductCost")}
                    value={it.unit_product_cost}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, unit_product_cost: Number(e.target.value) } : p,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-5">
                  {t("allocatedShipping")}: {money(preview.lines[idx]?.allocatedPerUnit ?? 0)} ·{" "}
                  {t("landedCost")}: {money(preview.lines[idx]?.landedPerUnit ?? 0)}
                </p>
              </div>
            ))}
          </div>

          <div>
            <Label>{t("notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
