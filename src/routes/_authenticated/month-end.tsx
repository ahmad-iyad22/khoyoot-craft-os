import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lock, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n, tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezDivider } from "@/components/tatreez";
import { ReceiptUpload } from "@/components/receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, money } from "@/lib/format";
import { downloadCsv, printReport } from "@/lib/export";
import { monthOptions } from "@/lib/ledger";
import { currentMonth, useStatement, type PartnerStatement } from "@/lib/month-end";

export const Route = createFileRoute("/_authenticated/month-end")({
  head: () => ({
    meta: [
      { title: "Month-end — Khoyoot" },
      { name: "description", content: "Monthly statement of what each partner takes or pays in." },
      { property: "og:title", content: "Month-end — Khoyoot" },
      { property: "og:description", content: "Monthly statement of what each partner takes or pays in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthEndPage,
});

const LINES: [keyof PartnerStatement, string, 1 | -1][] = [
  ["profit_share", "me_profitShare", 1],
  ["capital_returned", "cap_returned", 1],
  ["loss_share", "me_lossShare", -1],
  ["item_cost_owed", "me_itemCost", 1],
  ["paid_on_behalf", "me_paidOnBehalf", 1],
  ["owed_to_them", "me_owedToThem", 1],
  ["they_owe", "me_theyOwe", -1],
  ["withdrawals", "me_withdrawals", -1],
  ["carry_in", "me_carry", 1],
];

function MonthEndPage() {
  const roles = useRoles();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [settleFor, setSettleFor] = useState<PartnerStatement | null>(null);
  const [detailFor, setDetailFor] = useState<PartnerStatement | null>(null);
  const st = useStatement(month, roles.isOwner);
  const s = st.data;

  const toggle = useMutation({
    mutationFn: async (close: boolean) => {
      const { error } = await supabase.rpc((close ? "close_month" : "reopen_month") as never, { _month: `${month}-01` } as never);
      if (error) throw error;
      return close;
    },
    onSuccess: (close) => { toast.success(tt(close ? "me_closed" : "me_reopened")); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message.includes("CAPITAL_CLOSE_ORDER") ? t("cap_closeOrder") : e.message.includes("CAPITAL_REOPEN_ORDER") ? t("cap_reopenOrder") : e.message),
  });

  if (!roles.isLoading && !roles.isOwner) return <AccessDenied message={tt("me_onlyOwner")} />;

  const stHeaders = [t("ex_partner"), ...LINES.map(([, label]) => t(label)), t("me_final"), t("me_settled"), t("me_remaining")];
  const stRows = (s?.partners ?? []).map((p) => [
    p.name,
    ...LINES.map(([k, , sign]) => `${sign < 0 && Number(p[k]) ? "-" : ""}${Number(p[k] ?? 0).toFixed(2)}`),
    Number(p.final).toFixed(2),
    Number(p.settled).toFixed(2),
    Number(p.remaining).toFixed(2),
  ]);
  const stTitle = `${t("ex_statementTitle")} · ${month}`;
  const exportStCsv = () => downloadCsv(`month-end-${month}.csv`, stHeaders, stRows);
  const exportStPdf = () =>
    printReport(
      stTitle,
      [
        { heading: stTitle, headers: stHeaders, rows: stRows.map((r) => r.map(String)) },
        {
          heading: t("ex_cashCheck"),
          headers: [t("ex_line"), t("ex_amount")],
          rows: s
            ? [
                [t("me_cashAvailable"), money(s.cash.available)],
                [t("me_payouts"), money(s.cash.payouts)],
                [t("cap_reserve"), money(s.reserve_kept)],
                [t("bk_pendingTotal"), money(s.cash.pending_payouts)],
                [t("me_shortfall").replace("{amt}", ""), money(s.cash.shortfall)],
              ]
            : [],
        },
      ],
      lang,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("monthEnd")}
        description={t("me_subtitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={t("me_month")} value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {s && (
              <>
                <Button variant="outline" onClick={exportStCsv}>{t("ex_csv")}</Button>
                <Button variant="outline" onClick={exportStPdf}>{t("ex_pdf")}</Button>
              </>
            )}
            {s && (s.closed ? (
              <Button variant="outline" onClick={() => toggle.mutate(false)} disabled={toggle.isPending}><Unlock className="size-4" /> {t("me_reopen")}</Button>
            ) : (
              <Button onClick={() => toggle.mutate(true)} disabled={toggle.isPending}><Lock className="size-4" /> {t("me_close")}</Button>
            ))}
          </div>
        }
      />
      {s && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={s.closed ? "default" : "secondary"}>{s.closed ? t("me_closedOn").replace("{d}", formatDate(s.closed_at)) : t("me_live")}</Badge>
            {!s.previous_closed && <span className="text-xs text-muted-foreground">{t("me_prevNotClosed")}</span>}
            {Number(s.unallocated_profit) !== 0 && (
              <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3.5" /> {t("me_unallocated").replace("{amt}", money(s.unallocated_profit))}</span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {s.partners.map((p) => (
              <div key={p.partner_id} className="card-surface space-y-2 p-4 text-sm">
                <p className="font-display text-lg">{p.name}</p>
                {LINES.map(([k, label, sign]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t(label)}</span>
                    <span>{sign < 0 && Number(p[k]) ? "−" : ""}{money(p[k] as number)}</span>
                  </div>
                ))}
                <TatreezDivider />
                <div className="flex justify-between font-display text-lg">
                  <span>{t("me_final")}</span>
                  <span className={Number(p.final) < 0 ? "text-destructive" : "text-primary"}>
                    {Number(p.final) < 0 ? t("me_paysIn") : t("me_takes")} {money(Math.abs(Number(p.final)))}
                  </span>
                </div>
                <div className="flex justify-between text-xs"><span>{t("me_settled")}</span><span>{money(p.settled)}</span></div>
                <div className="flex justify-between text-xs"><span>{t("me_remaining")}</span><span>{money(p.remaining)}</span></div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setDetailFor(p)}>{t("me_details")}</Button>
                  <Button size="sm" disabled={!s.closed || Number(p.remaining) === 0} title={s.closed ? undefined : t("me_notClosedSettle")} onClick={() => setSettleFor(p)}>{t("me_settle")}</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-3 border-y py-3 text-sm"><span>{t("cap_reserve")}</span><span className="font-medium">{money(s.reserve_kept)}</span></div>
          <div className="card-surface space-y-1 p-4 text-sm">
            <p className="font-medium">{t("me_cashCheck")}</p>
            <div className="flex justify-between"><span>{t("me_cashAvailable")}</span><span>{money(s.cash.available)}</span></div>
            <div className="flex justify-between"><span>{t("me_payouts")}</span><span>{money(s.cash.payouts)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("bk_pendingTotal")}</span><span>{money(s.cash.pending_payouts)}</span></div>
            <p className={Number(s.cash.shortfall) > 0 ? "text-destructive" : "text-muted-foreground"}>
              {Number(s.cash.shortfall) > 0 ? t("me_shortfall").replace("{amt}", money(s.cash.shortfall)) : t("me_enough")}
            </p>
          </div>
        </>
      )}
      {settleFor && <SettleDialog month={month} p={settleFor} onClose={() => setSettleFor(null)} />}
      {detailFor && <DetailDialog month={month} p={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  );
}

function SettleDialog({ month, p, onClose }: { month: string; p: PartnerStatement; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const { error } = await supabase.rpc("settle_partner" as never, {
        _month: `${month}-01`, _partner_id: p.partner_id, _amount: Number(f.get("amount")), _date: String(f.get("date")),
        _receipt: String(f.get("receipt_path") ?? ""), _notes: String(f.get("notes") ?? ""),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(tt("me_settleSaved")); qc.invalidateQueries(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("me_settle")} · {p.name}</DialogTitle>
          <DialogDescription>{t("me_remaining")}: {money(p.remaining)}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t("amount")}</Label><Input name="amount" type="number" step="0.01" required defaultValue={p.remaining} /></div>
            <div className="space-y-2"><Label>{t("date")}</Label><Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          </div>
          <ReceiptUpload idPrefix="settle" />
          <div className="space-y-2"><Label>{t("notes")}</Label><Input name="notes" dir="auto" /></div>
          <DialogFooter><Button type="submit" disabled={save.isPending}>{t("save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ month, p, onClose }: { month: string; p: PartnerStatement; onClose: () => void }) {
  const { t, ts } = useI18n();
  const start = `${month}-01`;
  const d = new Date(start); d.setMonth(d.getMonth() + 1);
  const end = d.toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ["me-detail", month, p.partner_id],
    queryFn: async () => {
      const [lines, losses, exps, txns] = await Promise.all([
        supabase.from("order_line_profit" as never).select("*").gte("order_date", start).lt("order_date", end),
        supabase.from("stock_losses").select("*, products(name)").gte("loss_date", start).lt("loss_date", end),
        supabase.from("expenses").select("*, expense_splits(*)").eq("is_shared", true).gte("entry_date", start).lt("entry_date", end),
        supabase.from("partner_transactions").select("*").eq("partner_id", p.partner_id).gte("txn_date", start).lt("txn_date", end),
      ]);
      return { lines: (lines.data ?? []) as any[], losses: (losses.data ?? []) as any[], exps: (exps.data ?? []) as any[], txns: (txns.data ?? []) as any[] };
    },
  });
  const pct = (split: any) => Number((Array.isArray(split) ? split : []).find((x: any) => x.partner_id === p.partner_id)?.percent ?? 0);
  const data = q.data;
  const Row = ({ a, b }: { a: string; b: string }) => <div className="flex justify-between gap-2 border-t py-1 text-xs"><span className="truncate">{a}</span><span>{b}</span></div>;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{t("me_details")} · {p.name} · {month}</DialogTitle><DialogDescription>{t("me_subtitle")}</DialogDescription></DialogHeader>
        {data && (
          <div className="space-y-4 text-sm">
            <section><p className="font-medium">{t("me_orders")}</p>
              {!data.lines.length && <p className="text-xs text-muted-foreground">{t("me_nothing")}</p>}
            </section>
            <section><p className="font-medium">{t("me_losses")}</p>
              {data.losses.map((l) => <Row key={l.id} a={`${formatDate(l.loss_date)} · ${l.products?.name ?? "—"} · ${l.reason === "return_loss" ? t("ord_loss") : t(`wo_reason_${l.reason}`)}`} b={`${money(l.loss_amount)} → −${money((Number(l.loss_amount) * pct(l.profit_split)) / 100)}`} />)}
              {!data.losses.length && <p className="text-xs text-muted-foreground">{t("me_nothing")}</p>}
            </section>
            <section><p className="font-medium">{t("me_expenses")}</p>
              {data.exps.map((e) => {
                const mine = (e.expense_splits ?? []).find((x: any) => x.partner_id === p.partner_id);
                return <Row key={e.id} a={`${formatDate(e.entry_date)} · ${e.description ?? e.category}`} b={`${money(e.base_amount ?? e.amount)} · ${e.paid_by_partner_id === p.partner_id ? t("me_owedToThem") : t("me_theyOwe")} ${money(mine?.share_amount ?? 0)}`} />;
              })}
              {!data.exps.length && <p className="text-xs text-muted-foreground">{t("me_nothing")}</p>}
            </section>
            <section><p className="font-medium">{t("me_txns")}</p>
              {data.txns.map((x) => <Row key={x.id} a={`${formatDate(x.txn_date)} · ${t(`txn_${x.txn_type}`)}`} b={money(x.base_amount ?? x.amount)} />)}
              {!data.txns.length && <p className="text-xs text-muted-foreground">{t("me_nothing")}</p>}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
