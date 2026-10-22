import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n, tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezEmptyState, TatreezDivider } from "@/components/tatreez";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, money } from "@/lib/format";
import { marginState, formatPercent } from "@/lib/margin";

export const Route = createFileRoute("/_authenticated/products/$productId")({
  head: () => ({
    meta: [
      { title: "Product — Khoyoot" },
      { name: "description", content: "Full product file: costs, margin, sales, batches, serials and linked posts." },
      { property: "og:title", content: "Product — Khoyoot" },
      { property: "og:description", content: "Full product file: costs, margin, sales, batches, serials and linked posts." },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const roles = useRoles();
  const { t, ts } = useI18n();

  const productQ = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name), suppliers(name)")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const batchesQ = useQuery({
    queryKey: ["product-batches", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("*, shipments(reference), partners:cost_owed_partner_id(name)")
        .eq("product_id", productId)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const serialsQ = useQuery({
    queryKey: ["product-serials", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("serial_numbers")
        .select("*")
        .eq("product_id", productId)
        .order("serial");
      if (error) throw error;
      return data ?? [];
    },
  });

  const movementsQ = useQuery({
    queryKey: ["product-movements", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, profiles:user_id(full_name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lossesQ = useQuery({
    queryKey: ["product-losses", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_losses")
        .select("*")
        .eq("product_id", productId)
        .order("loss_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const salesQ = useQuery({
    queryKey: ["product-sales", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_line_profit" as never)
        .select("*")
        .eq("product_id", productId)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const postsQ = useQuery({
    queryKey: ["product-posts", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_calendar")
        .select("*")
        .eq("product_id", productId)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const marginHistoryQ = useQuery({
    queryKey: ["product-margin-history", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_history")
        .select("*")
        .eq("product_id", productId)
        .order("recorded_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!roles.isOwner && !roles.isOperations) {
    return <AccessDenied message={tt("Inventory is available to the Owner and the Operations partner.")} />;
  }

  const p = productQ.data as any;
  if (productQ.isLoading) {
    return <div className="py-16 text-center text-muted-foreground">{tt("Loading…")}</div>;
  }
  if (!p) {
    return (
      <div className="py-16">
        <TatreezEmptyState title={tt("Product not found")} />
        <div className="mt-4 text-center">
          <Link to="/inventory" className="text-sm text-primary underline">
            {tt("Back to inventory")}
          </Link>
        </div>
      </div>
    );
  }

  const batches = (batchesQ.data ?? []) as any[];
  const serials = (serialsQ.data ?? []) as any[];
  const movements = (movementsQ.data ?? []) as any[];
  const losses = (lossesQ.data ?? []) as any[];
  const sales = (salesQ.data ?? []) as any[];
  const posts = (postsQ.data ?? []) as any[];
  const marginHistory = (marginHistoryQ.data ?? []) as any[];

  // Cost breakdown from the most recent batch (landed = item + shipping + customs per unit).
  const latestBatch = batches[0];
  const unitItem = latestBatch ? Number(latestBatch.unit_cost) : Number(p.cost_price);
  const unitLanded = latestBatch ? Number(latestBatch.landed_unit_cost) : Number(p.avg_cost);
  const unitShipCustoms = Math.max(0, unitLanded - unitItem);
  const packaging = Number(p.packaging_cost_per_unit ?? 0);
  const ms = marginState(p);

  const soldQty = sales.reduce((s, r) => s + Number(r.quantity ?? 0) - Number(r.returned_qty ?? 0), 0);
  const revenue = sales.reduce((s, r) => s + Number(r.net_revenue ?? 0), 0);
  const profit = sales.reduce((s, r) => s + Number(r.profit ?? 0), 0);
  const inStockSerials = serials.filter((s) => s.status === "in_stock").length;

  const low = Number(p.stock_qty) <= Number(p.reorder_threshold);

  return (
    <div className="space-y-6">
      <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:-scale-x-100" /> {tt("Back to inventory")}
      </Link>

      <PageHeader
        title={p.name}
        description={`${p.sku} · ${p.categories?.name ?? tt("None")}${p.suppliers?.name ? ` · ${p.suppliers.name}` : ""}`}
        action={<StatusBadge status={p.status} />}
      />

      {/* Header card */}
      <div className="card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <ProductThumbnail url={p.image_url} name={p.name} size="size-20" />
        <div className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">{tt("Stock")}</div>
            <Badge variant={low ? "destructive" : "secondary"} className="mt-1">
              {p.stock_qty} / {tt("min")} {p.reorder_threshold}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tt("Sale")}</div>
            <div className="mt-1 font-medium">{money(p.sale_price)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tt("Weight")}</div>
            <div className="mt-1 font-medium">
              {Number(p.weight_grams ?? 0) > 0 ? `${Number(p.weight_grams)} g (${(Number(p.weight_grams) / 1000).toFixed(2)} kg)` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tt("Serials in stock")}</div>
            <div className="mt-1 font-medium">{p.tracks_serials ? inStockSerials : tt("Not tracked")}</div>
          </div>
        </div>
      </div>

      {p.notes && (
        <div className="card-surface p-4 text-sm">
          <div className="mb-1 text-xs uppercase text-muted-foreground">{tt("Notes")}</div>
          <p className="whitespace-pre-wrap">{p.notes}</p>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{tt("Overview")}</TabsTrigger>
          <TabsTrigger value="sales">{tt("Sales")}</TabsTrigger>
          <TabsTrigger value="batches">{tt("Batches")}</TabsTrigger>
          <TabsTrigger value="serials">{tt("Serials")}</TabsTrigger>
          <TabsTrigger value="movements">{tt("Movements")}</TabsTrigger>
          <TabsTrigger value="posts">{tt("Posts")}</TabsTrigger>
        </TabsList>

        {/* OVERVIEW: cost breakdown + margin */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card-surface p-5">
              <h3 className="font-display text-lg">{tt("Cost breakdown (per unit)")}</h3>
              <TatreezDivider className="my-3" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tt("Item cost (maker)")}</dt>
                  <dd className="font-medium">{money(unitItem)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tt("Shipping + customs")}</dt>
                  <dd className="font-medium">{money(unitShipCustoms)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tt("Packaging")}</dt>
                  <dd className="font-medium">{money(packaging)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-muted-foreground">{tt("Landed cost / unit")}</dt>
                  <dd className="font-semibold">{money(unitLanded)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tt("Weighted avg cost")}</dt>
                  <dd className="font-semibold">{money(p.avg_cost)}</dd>
                </div>
              </dl>
              {latestBatch && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {tt("From latest batch")}: {latestBatch.batch_code ?? "—"} · {formatDate(latestBatch.received_at)}
                </p>
              )}
            </div>

            <div className="card-surface p-5">
              <h3 className="font-display text-lg">{tt("Margin")}</h3>
              <TatreezDivider className="my-3" />
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl">{formatPercent(ms.margin)}</span>
                {ms.level === "alert" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" /> {tt("Below alert threshold")}
                  </Badge>
                )}
                {ms.level === "watch" && <Badge variant="secondary">{tt("Below target")}</Badge>}
                {ms.level === "ok" && <Badge variant="secondary">{tt("Healthy")}</Badge>}
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tt("Target margin")}</dt>
                  <dd>{formatPercent(ms.target, 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tt("Alert threshold")}</dt>
                  <dd>{formatPercent(ms.threshold, 0)}</dd>
                </div>
              </dl>
              {marginHistory.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs uppercase text-muted-foreground">{tt("Margin history")}</div>
                  <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {marginHistory.map((h) => (
                      <div key={h.id} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{formatDate(h.recorded_at)}</span>
                        <span>
                          {money(h.avg_cost)} → {money(h.selling_price)} · {formatPercent(Number(h.margin_percent))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reorder hint */}
          <div className="card-surface flex items-start gap-3 p-5">
            <Package className="mt-0.5 size-5 text-primary" />
            <div className="text-sm">
              <div className="font-medium">{tt("Reorder check")}</div>
              <p className="text-muted-foreground">
                {low
                  ? tt("Stock is at or below the minimum — consider reordering.")
                  : tt("Stock is above the minimum.")}{" "}
                {tt("Sold so far")}: {soldQty} {tt("pcs")} · {tt("Revenue")}: {money(revenue)} · {tt("Profit")}: {money(profit)}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Date")}</th>
                  <th className="px-4 py-3">{tt("Batch")}</th>
                  <th className="px-4 py-3">{tt("Qty")}</th>
                  <th className="px-4 py-3">{tt("Sale price")}</th>
                  <th className="px-4 py-3">{tt("Net revenue")}</th>
                  <th className="px-4 py-3">{tt("Profit")}</th>
                  <th className="px-4 py-3">{tt("Split")}</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((r) => (
                  <tr key={r.allocation_id} className="border-t">
                    <td className="px-4 py-3">{formatDate(r.order_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.batch_code ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.quantity}
                      {Number(r.returned_qty) > 0 && (
                        <span className="text-destructive"> (−{r.returned_qty})</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{money(r.sale_price)}</td>
                    <td className="px-4 py-3">{money(r.net_revenue)}</td>
                    <td className="px-4 py-3">{money(r.profit)}</td>
                    <td className="px-4 py-3">
                      {r.split_missing ? (
                        <Badge variant="destructive">{tt("Split missing")}</Badge>
                      ) : (
                        <SplitBadges split={r.effective_split} />
                      )}
                    </td>
                  </tr>
                ))}
                {!sales.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No sales yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* BATCHES */}
        <TabsContent value="batches">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Received")}</th>
                  <th className="px-4 py-3">{tt("Batch")}</th>
                  <th className="px-4 py-3">{tt("Shipment")}</th>
                  <th className="px-4 py-3">{tt("Qty")}</th>
                  <th className="px-4 py-3">{tt("Remaining")}</th>
                  <th className="px-4 py-3">{tt("Unit cost")}</th>
                  <th className="px-4 py-3">{tt("Landed / unit")}</th>
                  <th className="px-4 py-3">{tt("Split")}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(b.received_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.batch_code ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{b.shipments?.reference ?? "—"}</td>
                    <td className="px-4 py-3">{b.quantity}</td>
                    <td className="px-4 py-3">{b.remaining_qty ?? "—"}</td>
                    <td className="px-4 py-3">{money(b.unit_cost)}</td>
                    <td className="px-4 py-3">{money(b.landed_unit_cost)}</td>
                    <td className="px-4 py-3">
                      <SplitBadges split={b.profit_split} owedTo={b.partners?.name} />
                    </td>
                  </tr>
                ))}
                {!batches.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No batches yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* SERIALS */}
        <TabsContent value="serials">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Serial")}</th>
                  <th className="px-4 py-3">{tt("Status")}</th>
                  <th className="px-4 py-3">{tt("Created")}</th>
                </tr>
              </thead>
              <tbody>
                {serials.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{s.serial}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "in_stock" ? "secondary" : "outline"}>
                        {ts(s.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
                {!serials.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No serials for this product.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* MOVEMENTS + LOSSES */}
        <TabsContent value="movements" className="space-y-4">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Date")}</th>
                  <th className="px-4 py-3">{tt("Change")}</th>
                  <th className="px-4 py-3">{tt("Reason")}</th>
                  <th className="px-4 py-3">{tt("Note")}</th>
                  <th className="px-4 py-3">{tt("By")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={Number(m.change_qty) < 0 ? "text-destructive" : "text-primary"}>
                        {Number(m.change_qty) > 0 ? "+" : ""}
                        {m.change_qty}
                      </span>
                    </td>
                    <td className="px-4 py-3">{m.reason}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{m.profiles?.full_name ?? "—"}</td>
                  </tr>
                ))}
                {!movements.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No movements yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {losses.length > 0 && (
            <div className="card-surface overflow-x-auto">
              <div className="border-b px-4 py-3 text-sm font-medium">{tt("Write-offs & losses")}</div>
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{tt("Date")}</th>
                    <th className="px-4 py-3">{tt("Qty")}</th>
                    <th className="px-4 py-3">{tt("Reason")}</th>
                    <th className="px-4 py-3">{tt("Loss")}</th>
                  </tr>
                </thead>
                <tbody>
                  {losses.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-4 py-3">{formatDate(l.loss_date)}</td>
                      <td className="px-4 py-3">{l.quantity}</td>
                      <td className="px-4 py-3">{l.reason}</td>
                      <td className="px-4 py-3 text-destructive">{money(l.loss_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* POSTS */}
        <TabsContent value="posts">
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt("Date")}</th>
                  <th className="px-4 py-3">{tt("Title")}</th>
                  <th className="px-4 py-3">{tt("Platform")}</th>
                  <th className="px-4 py-3">{tt("Status")}</th>
                  <th className="px-4 py-3">{tt("Views")}</th>
                  <th className="px-4 py-3">{tt("Orders")}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(c.scheduled_date)}</td>
                    <td className="px-4 py-3">{c.title}</td>
                    <td className="px-4 py-3">{c.platform}</td>
                    <td className="px-4 py-3">{ts(c.status)}</td>
                    <td className="px-4 py-3">{c.views}</td>
                    <td className="px-4 py-3">{c.attributed_orders}</td>
                  </tr>
                ))}
                {!posts.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {tt("No linked posts yet.")}
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

function SplitBadges({ split, owedTo }: { split: any; owedTo?: string | null }) {
  if (!split || typeof split !== "object") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const entries = Object.entries(split as Record<string, unknown>).filter(([, v]) => typeof v === "number");
  if (!entries.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([name, pct]) => (
        <Badge key={name} variant="outline" className="text-xs">
          {name} {Number(pct)}%
        </Badge>
      ))}
      {owedTo && (
        <Badge variant="secondary" className="text-xs">
          {tt("cost →")} {owedTo}
        </Badge>
      )}
    </div>
  );
}
