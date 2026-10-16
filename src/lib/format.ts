export const CURRENCY = "RM";

export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${CURRENCY} ${n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function compactMoney(value: number) {
  return `${CURRENCY} ${Number(value ?? 0).toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

export function pct(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end), label: start.toLocaleString(undefined, { month: "long", year: "numeric" }) };
}

export const EXPENSE_CATEGORIES = [
  "shipping",
  "platform_fees",
  "ads",
  "supplies",
  "other",
] as const;

export const PLATFORMS = ["Shopee", "Lazada", "TikTok Shop", "Manual"] as const;

export const ORDER_STATUSES = ["pending", "shipped", "delivered", "completed", "cancelled"] as const;

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
