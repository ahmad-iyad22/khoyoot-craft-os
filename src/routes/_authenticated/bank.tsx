import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n, tt } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezEmptyState } from "@/components/tatreez";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload } from "@/components/receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, money } from "@/lib/format";
import { MoneyFields, readMoney, useAppSettings } from "@/lib/money";
import { useBalances } from "@/lib/month-end";

export const Route = createFileRoute("/_authenticated/bank")({
  head: () => ({
    meta: [
      { title: "Bank & cash — Khoyoot" },
      { name: "description", content: "Business bank, partner cash and platform wallet balances." },
      { property: "og:title", content: "Bank & cash — Khoyoot" },
      { property: "og:description", content: "Business bank, partner cash and platform wallet balances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BankPage,
});

const KINDS = ["business_bank", "partner_cash", "platform_wallet"] as const;
const TYPES = ["deposit", "investment", "platform_payout", "withdrawal", "expense_payment", "transfer", "adjustment"] as const;
const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function BankPage() {
  const roles = useRoles();
  const { t } = useI18n();
  const qc = useQueryClient();
  const base = useAppSettings().data?.base_currency ?? "MYR";
  const [acc, setAcc] = useState<{ row: any | null } | null>(null);
  const [txn, setTxn] = useState<{ row: any | null } | null>(null);
  const [del, setDel] = useState<{ table: "bank_accounts" | "bank_transactions"; id: string } | null>(null);
  const balQ = useBalances(roles.isOwner);
  const accountsQ = useQuery({
    queryKey: ["bank-accounts"], enabled: roles.isOwner,
    queryFn: async () => { const { data, error } = await supabase.from("bank_accounts" as never).select("*").order("name"); if (error) throw error; return (data ?? []) as any[]; },
  });
  const txnsQ = useQuery({
    queryKey: ["bank-txns"], enabled: roles.isOwner,
    queryFn: async () => { const { data, error } = await supabase.from("bank_transactions" as never).select("*").order("txn_date", { ascending: false }); if (error) throw error; return (data ?? []) as any[]; },
  });
  const partnersQ = useQuery({
    queryKey: ["partners-basic"],
    queryFn: async () => { const { data, error } = await supabase.from("partners").select("id, name").order("name"); if (error) throw error; return data ?? []; },
  });
  const done = (k: string) => () => { toast.success(tt(k)); qc.invalidateQueries(); };
  const fail = (e: Error) => toast.error(e.message);

  const saveAcc = useMutation({
    mutationFn: async (v: { id?: string; payload: any }) => {
      const q = supabase.from("bank_accounts" as never);
      const { error } = v.id ? await q.update(v.payload as never).eq("id", v.id) : await q.insert(v.payload as never);
      if (error) throw error;
    },
    onSuccess: () => { done("bk_saved")(); setAcc(null); }, onError: fail,
  });
  const saveTxn = useMutation({
    mutationFn: async (v: { id?: string; payload: any }) => {
      const q = supabase.from("bank_transactions" as never);
      const { error } = v.id ? await q.update(v.payload as never).eq("id", v.id) : await q.insert(v.payload as never);
      if (error) throw error;
    },
    onSuccess: () => { done("bk_saved")(); setTxn(null); }, onError: fail,
  });
  const remove = useMutation({
    mutationFn: async (v: { table: string; id: string }) => { const { error } = await supabase.from(v.table as never).delete().eq("id", v.id); if (error) throw error; },
    onSuccess: () => { done("bk_deleted")(); setDel(null); }, onError: fail,
  });
  const checkActual = useMutation({
    mutationFn: async (v: { id: string; value: number | null }) => {
      const { error } = await supabase.from("bank_accounts" as never).update({ actual_balance: v.value, actual_checked_at: new Date().toISOString().slice(0, 10) } as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: done("bk_saved"), onError: fail,
  });

  if (!roles.isLoading && !roles.isOwner) return <AccessDenied message={tt("me_onlyOwner")} />;
  const balances = balQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <PageHeader title={t("bankCash")} description={t("bk_subtitle")}
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={() => setAcc({ row: null })}><Plus className="size-4" /> {t("bk_addAccount")}</Button>
          <Button disabled={!accounts.length} onClick={() => setTxn({ row: null })}><Plus className="size-4" /> {t("bk_addTxn")}</Button>
        </div>} />

      <div className="grid gap-4 md:grid-cols-3">
        {balances.map((b) => {
          const native = Number(b.balance_native);
          const diff = b.actual_balance == null ? null : Math.round((Number(b.actual_balance) - native) * 100) / 100;
          const row = accounts.find((a) => a.id === b.id);
          return (
            <div key={b.id} className="card-surface space-y-2 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-display text-lg">{b.name}</p><p className="text-xs text-muted-foreground">{t(`bk_kind_${b.kind}`)}</p></div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => setAcc({ row })}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDel({ table: "bank_accounts", id: b.id })}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <div className="flex justify-between"><span>{t("bk_balance")}</span><span className="font-medium">{b.currency} {native.toFixed(2)}</span></div>
              {b.currency !== base && <div className="flex justify-between text-xs text-muted-foreground"><span>{base}</span><span>{money(b.balance_base)}</span></div>}
              {b.kind === "platform_wallet" && <div className="flex justify-between text-xs"><span>{t("bk_pending")}</span><span>{money(b.pending_payout)}</span></div>}
              <form className="flex items-end gap-2" onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get("actual") ?? "");
                checkActual.mutate({ id: b.id, value: v === "" ? null : Number(v) });
              }}>
                <div className="flex-1 space-y-1"><Label className="text-xs">{t("bk_actual")}</Label><Input name="actual" type="number" step="0.01" defaultValue={b.actual_balance ?? ""} className="h-8" /></div>
                <Button size="sm" variant="outline" type="submit">{t("bk_check")}</Button>
              </form>
              {diff !== null && <p className={"text-xs " + (diff === 0 ? "text-muted-foreground" : "text-destructive")}>{diff === 0 ? t("bk_matches") : t("bk_diff").replace("{amt}", `${b.currency} ${diff.toFixed(2)}`)}{b.actual_checked_at && ` · ${formatDate(b.actual_checked_at)}`}</p>}
            </div>
          );
        })}
        {!balances.length && <div className="md:col-span-3"><TatreezEmptyState title={t("bk_noAccounts")} /></div>}
      </div>

      <div className="card-surface overflow-x-auto">
        <p className="px-4 pt-3 font-medium">{t("bk_transactions")}</p>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-2 text-start">{t("date")}</th><th className="px-4 py-2 text-start">{t("bk_account")}</th>
            <th className="px-4 py-2 text-start">{t("bk_type")}</th><th className="px-4 py-2 text-start">{t("amount")}</th>
            <th className="px-4 py-2 text-start">{t("bk_note")}</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {(txnsQ.data ?? []).map((x) => (
              <tr key={x.id} className="border-t">
                <td className="px-4 py-2">{formatDate(x.txn_date)}</td>
                <td className="px-4 py-2">{nameOf(x.account_id)}{x.txn_type === "transfer" && ` → ${nameOf(x.to_account_id)}`}</td>
                <td className="px-4 py-2">{t(`bk_t_${x.txn_type}`)}</td>
                <td className="px-4 py-2">{x.currency} {Number(x.amount).toFixed(2)}{x.currency !== base && <span className="text-xs text-muted-foreground"> · {money(x.base_amount)}</span>}</td>
                <td className="px-4 py-2 text-muted-foreground">{x.note}</td>
                <td className="px-4 py-2"><div className="flex justify-end">
                  <Button size="icon" variant="ghost" aria-label={t("edit")} onClick={() => setTxn({ row: x })}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => setDel({ table: "bank_transactions", id: x.id })}><Trash2 className="size-4" /></Button>
                </div></td>
              </tr>
            ))}
            {!(txnsQ.data ?? []).length && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">{t("bk_noTxns")}</td></tr>}
          </tbody>
        </table>
      </div>

      <ConfirmDelete open={!!del} onOpenChange={(v) => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />

      <Dialog open={!!acc} onOpenChange={(v) => !v && setAcc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{acc?.row ? t("bk_editAccount") : t("bk_addAccount")}</DialogTitle><DialogDescription>{t("bk_subtitle")}</DialogDescription></DialogHeader>
          {acc && (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveAcc.mutate({ id: acc.row?.id, payload: {
                name: String(f.get("name")), kind: String(f.get("kind")), partner_id: String(f.get("partner_id") || "") || null,
                currency: String(f.get("currency") || base).toUpperCase(), opening_balance: Number(f.get("opening_balance") || 0),
                opening_fx: Number(f.get("opening_fx") || 1), opening_date: String(f.get("opening_date")), pending_payout: Number(f.get("pending_payout") || 0),
              } });
            }}>
              <div className="space-y-2"><Label>{t("bk_name")}</Label><Input name="name" required defaultValue={acc.row?.name ?? ""} dir="auto" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{t("bk_kind")}</Label>
                  <select name="kind" defaultValue={acc.row?.kind ?? "business_bank"} className={sel}>{KINDS.map((k) => <option key={k} value={k}>{t(`bk_kind_${k}`)}</option>)}</select></div>
                <div className="space-y-2"><Label>{t("bk_partner")}</Label>
                  <select name="partner_id" defaultValue={acc.row?.partner_id ?? ""} className={sel}><option value="">—</option>{(partnersQ.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="space-y-2"><Label>{t("currency")}</Label><Input name="currency" maxLength={3} defaultValue={acc.row?.currency ?? base} /></div>
                <div className="space-y-2"><Label>{t("bk_openingFx")}</Label><Input name="opening_fx" type="number" step="0.000001" min="0.000001" defaultValue={acc.row?.opening_fx ?? 1} /></div>
                <div className="space-y-2"><Label>{t("bk_opening")}</Label><Input name="opening_balance" type="number" step="0.01" defaultValue={acc.row?.opening_balance ?? 0} /></div>
                <div className="space-y-2"><Label>{t("bk_openingDate")}</Label><Input name="opening_date" type="date" required defaultValue={acc.row?.opening_date ?? new Date().toISOString().slice(0, 10)} /></div>
              </div>
              <div className="space-y-2"><Label>{t("bk_pending")} ({base})</Label><Input name="pending_payout" type="number" step="0.01" min={0} defaultValue={acc.row?.pending_payout ?? 0} /></div>
              <DialogFooter><Button type="submit" disabled={saveAcc.isPending}>{t("save")}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!txn} onOpenChange={(v) => !v && setTxn(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{txn?.row ? t("bk_editTxn") : t("bk_addTxn")}</DialogTitle><DialogDescription>{t("bk_subtitle")}</DialogDescription></DialogHeader>
          {txn && (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const type = String(f.get("txn_type"));
              saveTxn.mutate({ id: txn.row?.id, payload: {
                account_id: String(f.get("account_id")), to_account_id: type === "transfer" ? String(f.get("to_account_id") || "") || null : null,
                txn_type: type, txn_date: String(f.get("txn_date")), note: String(f.get("note") || "") || null,
                receipt_path: String(f.get("receipt_path") || "") || null, ...readMoney(f),
              } });
            }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{t("bk_account")}</Label>
                  <select name="account_id" required defaultValue={txn.row?.account_id ?? accounts[0]?.id} className={sel}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div className="space-y-2"><Label>{t("bk_type")}</Label>
                  <select name="txn_type" defaultValue={txn.row?.txn_type ?? "deposit"} className={sel}>{TYPES.map((k) => <option key={k} value={k}>{t(`bk_t_${k}`)}</option>)}</select></div>
                <div className="space-y-2"><Label>{t("bk_toAccount")}</Label>
                  <select name="to_account_id" defaultValue={txn.row?.to_account_id ?? ""} className={sel}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div className="space-y-2"><Label>{t("date")}</Label><Input name="txn_date" type="date" required defaultValue={txn.row?.txn_date ?? new Date().toISOString().slice(0, 10)} /></div>
              </div>
              <MoneyFields idPrefix="bt" defaultAmount={txn.row?.amount} defaultCurrency={txn.row?.currency} defaultFx={txn.row?.fx_rate_to_base} />
              <div className="space-y-2"><Label>{t("bk_note")}</Label><Input name="note" dir="auto" defaultValue={txn.row?.note ?? ""} /></div>
              <ReceiptUpload idPrefix="bt" defaultPath={txn.row?.receipt_path} />
              <DialogFooter><Button type="submit" disabled={saveTxn.isPending}>{t("save")}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
