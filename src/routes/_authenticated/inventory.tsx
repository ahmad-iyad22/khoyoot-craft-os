import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PackagePlus, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n , tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezEmptyState } from "@/components/tatreez";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, money, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Khoyoot" },
      { name: "description", content: "Products, stock levels, received batches and stock movement history." },
      { property: "og:title", content: "Inventory — Khoyoot" },
      { property: "og:description", content: "Products, stock levels, received batches and stock movement history." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const roles = useRoles();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [search, setSearch] = useState("");

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name), suppliers(name)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const movementsQ = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(name, sku), profiles:user_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const batchesQ = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("*, products(name, sku)")
        .order("received_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const serialsQ = useQuery({
    queryKey: ["serials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("serial_numbers")
        .select("*, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const suppliersQ = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const receive = useMutation({
    mutationFn: async (form: {
      product_id: string;
      quantity: number;
      unit_cost: number;
      shipping_cost: number;
      supplier_id: string | null;
      batch_code: string | null;
      received_at: string;
      notes: string | null;
      serials: string[] | null;
    }) => {
      const args: Record<string, unknown> = {
        _product_id: form.product_id,
        _quantity: form.quantity,
        _unit_cost: form.unit_cost,
        _shipping_cost: form.shipping_cost,
        _received_at: form.received_at,
      };
      if (form.supplier_id) args["_supplier_id"] = form.supplier_id;
      if (form.batch_code) args["_batch_code"] = form.batch_code;
      if (form.notes) args["_notes"] = form.notes;
      if (form.serials?.length) args["_serials"] = form.serials;
      const { error } = await supabase.rpc("receive_stock", args as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Stock received"));
      setReceiveOpen(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async (v: { product_id: string; change: number; reason: string; note: string }) => {
      const { error } = await supabase.rpc("adjust_stock", {
        _product_id: v.product_id,
        _change: v.change,
        _reason: v.reason,
        _note: v.note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Stock adjusted"));
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isOperations) {
    return <AccessDenied message={tt("Inventory is available to the Owner and the Operations partner.")} />;
  }

  const products = (productsQ.data ?? []) as any[];
  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.name_ar ?? "").includes(search),
  );

  return (
    <div>
      <PageHeader
        title={t("inventory")}
        description={t("inventorySubtitle")}
        action={
          <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
            <DialogTrigger asChild>
              <Button>
                <PackagePlus className="size-4" /> {t("receiveStock")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{tt("Receive stock")}</DialogTitle>
                <DialogDescription>
                  {tt("Landed cost per unit = unit cost + shipping split across the batch. Weighted average cost updates automatically.")}
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  const serialsRaw = String(f.get("serials") ?? "").trim();
                  receive.mutate({
                    product_id: String(f.get("product_id")),
                    quantity: Number(f.get("quantity")),
                    unit_cost: Number(f.get("unit_cost")),
                    shipping_cost: Number(f.get("shipping_cost") || 0),
                    supplier_id: (f.get("supplier_id") as string) || null,
                    batch_code: (f.get("batch_code") as string) || null,
                    received_at: String(f.get("received_at")),
                    notes: (f.get("notes") as string) || null,
                    serials: serialsRaw ? serialsRaw.split(/[\n,]+/).map((s) => s.trim()) : null,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>{tt("Product")}</Label>
                  <Select name="product_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder={tt("Choose product")} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>{tt("Quantity")}</Label>
                    <Input name="quantity" type="number" min={1} required defaultValue={1} />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Unit cost")}</Label>
                    <Input name="unit_cost" type="number" step="0.01" min={0} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Shipping")}</Label>
                    <Input name="shipping_cost" type="number" step="0.01" min={0} defaultValue={0} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{tt("Supplier")}</Label>
                    <Select name="supplier_id">
                      <SelectTrigger>
                        <SelectValue placeholder={tt("Optional")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(suppliersQ.data ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("Received on")}</Label>
                    <Input
                      name="received_at"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tt("Batch code (optional)")}</Label>
                  <Input name="batch_code" placeholder="NAB-2026-04" />
                </div>
                <div className="space-y-2">
                  <Label>{tt("Serial numbers (optional, one per line)")}</Label>
                  <Textarea name="serials" rows={3} placeholder="KH-0001&#10;KH-0002" />
                </div>
                <div className="space-y-2">
                  <Label>{tt("Notes")}</Label>
                  <Textarea name="notes" rows={2} dir="auto" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={receive.isPending}>
                    {tt(receive.isPending ? "Saving…" : "Receive stock")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{tt("Products")}</TabsTrigger>
          <TabsTrigger value="batches">{tt("Batches")}</TabsTrigger>
          <TabsTrigger value="serials">{tt("Serials")}</TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1 size-3.5" /> {tt("Movements")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-3">
          <Input
            placeholder={t("searchProducts")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
            dir="auto"
          />
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("SKU")}</th>
                  <th className="px-4 py-3">{tt("Product")}</th>
                  <th className="px-4 py-3">{tt("Category")}</th>
                  <th className="px-4 py-3">{tt("Cost")}</th>
                  <th className="px-4 py-3">{tt("Avg cost")}</th>
                  <th className="px-4 py-3">{tt("Sale")}</th>
                  <th className="px-4 py-3">{tt("Stock")}</th>
                  <th className="px-4 py-3">{tt("Adjust")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = Number(p.stock_qty) <= Number(p.reorder_threshold);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-md border object-cover" />
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-md border bg-muted" />
                          )}
                          <div>
                            <div className="font-medium">{p.name}</div>
                            {p.name_ar && (
                              <div className="text-xs text-muted-foreground" dir="rtl">
                                {p.name_ar}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{p.categories?.name ?? "—"}</td>
                      <td className="px-4 py-3">{money(p.cost_price)}</td>
                      <td className="px-4 py-3">{money(p.avg_cost)}</td>
                      <td className="px-4 py-3">{money(p.sale_price)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={low ? "destructive" : "secondary"}>
                          {p.stock_qty} / {tt("min")} {p.reorder_threshold}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              adjust.mutate({ product_id: p.id, change: -1, reason: "manual_adjustment", note: "-1 via inventory" })
                            }
                          >
                            −
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              adjust.mutate({ product_id: p.id, change: 1, reason: "manual_adjustment", note: "+1 via inventory" })
                            }
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      <TatreezEmptyState title={t("noProducts")} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="batches">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Received")}</th>
                  <th className="px-4 py-3">{tt("Product")}</th>
                  <th className="px-4 py-3">{tt("Batch")}</th>
                  <th className="px-4 py-3">{tt("Qty")}</th>
                  <th className="px-4 py-3">{tt("Unit cost")}</th>
                  <th className="px-4 py-3">{tt("Shipping")}</th>
                  <th className="px-4 py-3">{tt("Landed / unit")}</th>
                </tr>
              </thead>
              <tbody>
                {((batchesQ.data ?? []) as any[]).map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(b.received_at)}</td>
                    <td className="px-4 py-3">{b.products?.name}</td>
                    <td className="px-4 py-3">{b.batch_code ?? "—"}</td>
                    <td className="px-4 py-3">{b.quantity}</td>
                    <td className="px-4 py-3">{money(b.unit_cost)}</td>
                    <td className="px-4 py-3">{money(b.shipping_cost)}</td>
                    <td className="px-4 py-3 font-medium">{money(b.landed_unit_cost)}</td>
                  </tr>
                ))}
                {!(batchesQ.data ?? []).length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No batches received yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="serials">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Serial")}</th>
                  <th className="px-4 py-3">{tt("Product")}</th>
                  <th className="px-4 py-3">{tt("Status")}</th>
                  <th className="px-4 py-3">{tt("Added")}</th>
                </tr>
              </thead>
              <tbody>
                {((serialsQ.data ?? []) as any[]).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{s.serial}</td>
                    <td className="px-4 py-3">{s.products?.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{tt(titleCase(s.status))}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
                {!(serialsQ.data ?? []).length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No serial numbers recorded.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("When")}</th>
                  <th className="px-4 py-3">{tt("Product")}</th>
                  <th className="px-4 py-3">{tt("Change")}</th>
                  <th className="px-4 py-3">{tt("Reason")}</th>
                  <th className="px-4 py-3">{tt("By")}</th>
                </tr>
              </thead>
              <tbody>
                {((movementsQ.data ?? []) as any[]).map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3">{m.products?.name}</td>
                    <td
                      className={
                        "px-4 py-3 font-medium " + (m.change_qty >= 0 ? "text-success" : "text-destructive")
                      }
                    >
                      {m.change_qty > 0 ? "+" : ""}
                      {m.change_qty}
                    </td>
                    <td className="px-4 py-3">{tt(titleCase(m.reason))}</td>
                    <td className="px-4 py-3">{m.profiles?.full_name ?? "—"}</td>
                  </tr>
                ))}
                {!(movementsQ.data ?? []).length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No stock movements yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
