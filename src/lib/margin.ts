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
 * Shipment cost allocation, exactly as specified:
 * cost per kg = FULL shipping cost paid / total shipment weight (never prorated down),
 * allocated per line = cost per kg * line weight, per unit = line / quantity,
 * landed cost per unit = product cost per unit + allocated shipping per unit.
 */
export function allocateShipment(
  totalShippingCost: number,
  items: { quantity: number; total_weight_kg: number; unit_product_cost: number }[],
) {
  const totalWeight = items.reduce((s, i) => s + Number(i.total_weight_kg || 0), 0);
  const costPerKg = totalWeight > 0 ? Number(totalShippingCost || 0) / totalWeight : 0;
  return {
    totalWeight,
    costPerKg,
    lines: items.map((i) => {
      const line = costPerKg * Number(i.total_weight_kg || 0);
      const perUnit = Number(i.quantity) > 0 ? line / Number(i.quantity) : 0;
      return {
        allocatedLine: line,
        allocatedPerUnit: perUnit,
        landedPerUnit: Number(i.unit_product_cost || 0) + perUnit,
      };
    }),
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
