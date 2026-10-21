import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { TatreezEmptyState } from "@/components/tatreez";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReceiptUpload, openReceipt } from "@/components/receipt-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { MoneyFields, fmtMoney, readMoney, useAppSettings } from "@/lib/money";
import { computeLedger, inMonth, monthOptions } from "@/lib/ledger";

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "Partners — Khoyoot" },
      { name: "description", content: "Partner transactions, shared expense balances and the monthly partner ledger." },
      { property: "og:title", content: "Partners — Khoyoot" },
      { property: "og:description", content: "Partner transactions, shared expense balances and the monthly partner ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const TXN_TYPES = ["contribution", "withdrawal", "paid_on_behalf", "profit_share"] as const;

function PartnersPage() {
  const roles = useRoles();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const baseCur = useAppSettings().data?.base_currency ?? "MYR";
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editPartner, setEditPartner] = useState<any | null>(null);
  const [txn, setTxn] = useState<{ partner: any; row: any | null } | null>(null);
  const [inv, setInv] = useState<{ row: any | null } | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "partner" | "txn"; id: string } | null>(null);

  const partnersQ = useQuery({
    queryKey: ["partners"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("*, partner_transactions(*)").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const expensesQ = useQuery({
    queryKey: ["shared-expenses"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*, expense_splits(*)").eq("is_shared", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["partners"] });
    qc.invalidateQueries({ queryKey: ["shared-expenses"] });
  };

  const savePartner = useMutation({
    mutationFn: async (v: { id?: string; name: string; notes: string | null; location: string }) => {
      const payload = { name: v.name, notes: v.notes, location: v.location };
      const { error } = v.id
        ? await supabase.from("partners").update(payload).eq("id", v.id)
        : await supabase.from("partners").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setEditPartner(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTxn = useMutation({
    mutationFn: async (v: { id?: string; payload: Record<string, unknown> }) => {
      const { error } = v.id
        ? await supabase.from("partner_transactions").update(v.payload as never).eq("id", v.id)
        : await supabase.from("partner_transactions").insert(v.payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      setTxn(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (v: { kind: "partner" | "txn"; id: string }) => {
      const { error } = await supabase.from(v.kind === "partner" ? "partners" : "partner_transactions").delete().eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const partners = (partnersQ.data ?? []) as any[];
  const allTxns = useMemo(() => partners.flatMap((p) => p.partner_transactions ?? []), [partners]);
  const ledger = useMemo(
    () => computeLedger(partners, allTxns, (expensesQ.data ?? []) as any[], month),
    [partners, allTxns, expensesQ.data, month],
  );

  if (!roles.isLoading && !roles.isOwner) return <AccessDenied message={t("partnersOwnerOnly")} />;

  const monthLabel = (m: string) =>
    new Date(m + "-01T00:00:00").toLocaleDateString(lang === "ar" ? "ar" : "en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title={t("partners")}
        description={t("partnersSubtitle")}
        action={
          <Button onClick={() => setEditPartner({})}>
            <Plus className="size-4" /> {t("addPartner")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="month">{t("month")}</Label>
          <select id="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{t("allTime")}</option>
            {monthOptions().map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">{t("partners")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("partnerLedger")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {partners.map((p) => {
              const row = ledger.find((r) => r.partnerId === p.id);
              const txns = [...(p.partner_transactions ?? [])]
                .filter((x: any) => inMonth(x.txn_date, month))
                .sort((a: any, b: any) => (a.txn_date < b.txn_date ? 1 : -1));
              return (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="font-display text-xl">{p.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground" dir="auto">
                        {[p.location, p.notes].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditPartner(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => setToDelete({ kind: "partner", id: p.id })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Stat label={t("contributions")} value={fmtMoney(row?.contributions, baseCur)} />
                      <Stat label={t("withdrawals")} value={fmtMoney(row?.withdrawals, baseCur)} />
                      <Stat label={t("paidOnBehalf")} value={fmtMoney(row?.paidOnBehalf, baseCur)} />
                      <Stat label={t("net")} value={fmtMoney(row?.net, baseCur)} strong />
                    </div>
                    <div className="space-y-2">
                      {txns.map((x: any) => (
                        <div key={x.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={x.txn_type === "withdrawal" ? "destructive" : "secondary"}>{t(`txn_${x.txn_type}`)}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(x.txn_date)}</span>
                            </div>
                            {x.notes && <p className="mt-1 truncate text-xs text-muted-foreground" dir="auto">{x.notes}</p>}
                          </div>
                          <div className="text-end tabular-nums">
                            <div>{fmtMoney(x.amount, x.currency ?? baseCur)}</div>
                            {x.currency && x.currency !== baseCur && (
                              <div className="text-xs text-muted-foreground">{fmtMoney(x.base_amount, baseCur)}</div>
                            )}
                          </div>
                          {x.receipt_path ? (
                            <Button variant="ghost" size="icon" className="size-7" aria-label={t("viewReceipt")} onClick={() => openReceipt(x.receipt_path)}>
                              <Paperclip className="size-4" />
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" className="size-7" aria-label={t("edit")} onClick={() => setTxn({ partner: p, row: x })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7" aria-label={t("delete")} onClick={() => setToDelete({ kind: "txn", id: x.id })}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      {!txns.length && <p className="py-3 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setTxn({ partner: p, row: null })}>
                      <Plus className="size-4" /> {t("addTransaction")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {!partners.length && <TatreezEmptyState title={t("noPartners")} />}
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("partner")}</TableHead>
                    <TableHead className="text-end">{t("contributions")}</TableHead>
                    <TableHead className="text-end">{t("withdrawals")}</TableHead>
                    <TableHead className="text-end">{t("paidOnBehalf")}</TableHead>
                    <TableHead className="text-end">{t("txn_profit_share")}</TableHead>
                    <TableHead className="text-end">{t("expenseShare")}</TableHead>
                    <TableHead className="text-end">{t("othersOweThem")}</TableHead>
                    <TableHead className="text-end">{t("theyOweOthers")}</TableHead>
                    <TableHead className="text-end">{t("net")}</TableHead>
                    <TableHead>{t("receipts")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((r) => (
                    <TableRow key={r.partnerId}>
                      <TableCell className="font-medium">{partners.find((p) => p.id === r.partnerId)?.name}</TableCell>
                      {[r.contributions, r.withdrawals, r.paidOnBehalf, r.profitShare, r.expenseShare, r.owedToThem, r.theyOwe].map((v, i) => (
                        <TableCell key={i} className="text-end tabular-nums">{fmtMoney(v, baseCur)}</TableCell>
                      ))}
                      <TableCell className={"text-end font-medium tabular-nums " + (r.net < 0 ? "text-destructive" : "text-primary")}>
                        {fmtMoney(r.net, baseCur)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="text-success">{r.withReceipt} {t("withReceipt")}</span>
                        {r.withoutReceipt > 0 && <span className="ms-2 text-muted-foreground">{r.withoutReceipt} {t("noReceipt")}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs text-muted-foreground">{t("ledgerExplain")}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editPartner} onOpenChange={(o) => !o && setEditPartner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPartner?.id ? t("editPartner") : t("addPartner")}</DialogTitle>
          </DialogHeader>
          {editPartner && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                savePartner.mutate({
                  ...(editPartner.id ? { id: editPartner.id } : {}),
                  name: String(f.get("name")).trim(),
                  location: String(f.get("location") || "").trim(),
                  notes: String(f.get("notes") || "").trim() || null,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="p-name">{t("name")}</Label>
                <Input id="p-name" name="name" required defaultValue={editPartner.name ?? ""} dir="auto" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-loc">{t("location")}</Label>
                <Input id="p-loc" name="location" defaultValue={editPartner.location ?? ""} dir="auto" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-notes">{t("roleNote")}</Label>
                <Textarea id="p-notes" name="notes" defaultValue={editPartner.notes ?? ""} dir="auto" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={savePartner.isPending}>{t("save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!txn} onOpenChange={(o) => !o && setTxn(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {txn?.row ? t("editTransaction") : t("addTransaction")} — {txn?.partner.name}
            </DialogTitle>
          </DialogHeader>
          {txn && (
            <form
              key={txn.row?.id ?? "new"}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const m = readMoney(f);
                if (m.amount <= 0) {
                  toast.error(t("amountPositive"));
                  return;
                }
                saveTxn.mutate({
                  ...(txn.row ? { id: txn.row.id } : {}),
                  payload: {
                    partner_id: txn.partner.id,
                    txn_type: String(f.get("txn_type")),
                    txn_date: String(f.get("txn_date")),
                    notes: String(f.get("notes") || "").trim() || null,
                    receipt_path: String(f.get("receipt_path") || "") || null,
                    ...m,
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="t-type">{t("type")}</Label>
                  <select id="t-type" name="txn_type" defaultValue={txn.row?.txn_type ?? "contribution"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {TXN_TYPES.map((k) => (
                      <option key={k} value={k}>{t(`txn_${k}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-date">{t("date")}</Label>
                  <Input id="t-date" name="txn_date" type="date" defaultValue={txn.row?.txn_date ?? today()} required />
                </div>
              </div>
              <MoneyFields idPrefix="t" defaultAmount={txn.row?.amount} defaultCurrency={txn.row?.currency} defaultFx={txn.row?.fx_rate_to_base} />
              <div className="space-y-2">
                <Label htmlFor="t-notes">{t("notes")}</Label>
                <Textarea id="t-notes" name="notes" defaultValue={txn.row?.notes ?? ""} placeholder={t("txnNoteHint")} dir="auto" />
              </div>
              <ReceiptUpload idPrefix="t" defaultPath={txn.row?.receipt_path} />
              <DialogFooter>
                <Button type="submit" disabled={saveTxn.isPending}>{t("save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        description={toDelete?.kind === "partner" ? t("deletePartnerBody") : undefined}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"tabular-nums " + (strong ? "font-display text-lg" : "font-medium")}>{value}</p>
    </div>
  );
}
