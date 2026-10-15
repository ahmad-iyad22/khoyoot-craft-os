export type MarginProduct = {
  sale_price?: number | string | null;
  avg_cost?: number | string | null;
  target_margin?: number | string | null;
  margin_alert_threshold?: number | string | null;
};

/** actual_margin = (selling_price - weighted avg cost) / selling_price, in percent. */
export function actualMargin(p: MarginProduct) {
  const price = Number(p.sale_price ?? 0);
  const cost = Number(p.avg_cost ?? 0);
  if (price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export function marginState(p: MarginProduct) {
  const margin = actualMargin(p);
  const target = Number(p.target_margin ?? 30);
  const threshold = Number(p.margin_alert_threshold ?? 20);
  if (margin === null) return { margin: null, target, threshold, level: "unknown" as const };
  if (margin < threshold) return { margin, target, threshold, level: "alert" as const };
  if (margin < target) return { margin, target, threshold, level: "watch" as const };
  return { margin, target, threshold, level: "ok" as const };
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(digits)}%`;
}

/**
 * Weight-based allocation (mirrors the database allocate_shipment function).
 * cost per kg = (shipping + customs, in base) / total weight. Line amounts are rounded to 2 decimals
 * and the rounding remainder goes on the last line so lines add up exactly to the shipment totals.
 * The FULL cost paid is always used. Item cost (May's cost) is never reduced by shipping or customs.
 */
export function allocateByWeight(
  shippingBase: number,
  customsBase: number,
  lines: { quantity: number; weight_kg: number; product_cost: number | null }[],
) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const totalWeight = lines.reduce((s, l) => s + (Number(l.weight_kg) || 0), 0);
  let sa = 0;
  let ca = 0;
  const out = lines.map((l, i) => {
    const w = Number(l.weight_kg) || 0;
    let ship = 0;
    let cust = 0;
    if (totalWeight > 0) {
      if (i === lines.length - 1) {
        ship = r2(shippingBase - sa);
        cust = r2(customsBase - ca);
      } else {
        ship = r2((shippingBase * w) / totalWeight);
        cust = r2((customsBase * w) / totalWeight);
      }
    }
    sa += ship;
    ca += cust;
    const q = Number(l.quantity) || 0;
    const shipUnit = q > 0 ? ship / q : 0;
    const custUnit = q > 0 ? cust / q : 0;
    return {
      weightShare: totalWeight > 0 ? (w / totalWeight) * 100 : 0,
      shipLine: ship,
      custLine: cust,
      shipUnit,
      custUnit,
      landedUnit: l.product_cost === null ? null : r2(Number(l.product_cost) + shipUnit + custUnit),
    };
  });
  return {
    totalWeight,
    costPerKg: totalWeight > 0 ? (shippingBase + customsBase) / totalWeight : 0,
    lines: out,
  };
}

/** new_avg = ((qty * avg) + (newQty * newLanded)) / (qty + newQty) */
export function weightedAverage(qty: number, avg: number, newQty: number, newLanded: number) {
  const total = qty + newQty;
  if (total <= 0) return 0;
  return (qty * avg + newQty * newLanded) / total;
}

export const SELLABLE_STATUSES = ["active", "ready"] as const;

export const PRODUCT_STATUSES = [
  "idea",
  "in_development",
  "preparing",
  "ready",
  "future_product",
  "active",
  "out_of_stock",
  "discontinued",
] as const;

export const SHIPMENT_STAGES = [
  "preparing",
  "sent_from_palestine",
  "in_transit",
  "customs",
  "arrived_in_malaysia",
  "added_to_inventory",
] as const;
