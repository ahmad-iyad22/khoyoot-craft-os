export type LedgerRow = {
  partnerId: string;
  contributions: number;
  withdrawals: number;
  paidOnBehalf: number;
  profitShare: number;
  expenseShare: number;
  owedToThem: number;
  theyOwe: number;
  net: number;
  withReceipt: number;
  withoutReceipt: number;
};

const base = (r: any) => Number(r.base_amount ?? r.amount ?? 0);
export const inMonth = (date: string, month: string) => !month || String(date).slice(0, 7) === month;

/** Computes each partner's position for one month ("" = all time). All values in base currency. */
export function computeLedger(partners: any[], txns: any[], expenses: any[], month: string): LedgerRow[] {
  const rows = new Map<string, LedgerRow>();
  for (const p of partners)
    rows.set(p.id, {
      partnerId: p.id, contributions: 0, withdrawals: 0, paidOnBehalf: 0, profitShare: 0,
      expenseShare: 0, owedToThem: 0, theyOwe: 0, net: 0, withReceipt: 0, withoutReceipt: 0,
    });
  for (const t of txns) {
    const r = rows.get(t.partner_id);
    if (!r || !inMonth(t.txn_date, month)) continue;
    const v = base(t);
    if (t.txn_type === "contribution") r.contributions += v;
    else if (t.txn_type === "withdrawal") r.withdrawals += v;
    else if (t.txn_type === "paid_on_behalf") r.paidOnBehalf += v;
    else if (t.txn_type === "profit_share") r.profitShare += v;
    if (t.receipt_path) r.withReceipt++;
    else r.withoutReceipt++;
  }
  for (const e of expenses) {
    if (!e.is_shared || !inMonth(e.entry_date, month)) continue;
    const payer = e.paid_by_business ? null : e.paid_by_partner_id;
    const payerRow = payer ? rows.get(payer) : undefined;
    if (payerRow) {
      if (e.receipt_path) payerRow.withReceipt++;
      else payerRow.withoutReceipt++;
    }
    for (const s of e.expense_splits ?? []) {
      const r = rows.get(s.partner_id);
      if (!r) continue;
      const share = Number(s.share_amount);
      r.expenseShare += share;
      if (payer && s.partner_id !== payer) {
        r.theyOwe += share;
        if (payerRow) payerRow.owedToThem += share;
      }
    }
  }
  for (const r of rows.values())
    r.net = r.contributions + r.paidOnBehalf + r.profitShare + r.owedToThem - r.withdrawals - r.theyOwe;
  return [...rows.values()];
}

export function monthOptions(count = 18) {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
