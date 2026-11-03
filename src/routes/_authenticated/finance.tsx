import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { tt } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, monthRange, titleCase } from "@/lib/format";
import { downloadCsv, printReport } from "@/lib/export";
import { MoneyFields, categoryLabel, readMoney, useExpenseCategories, useAppSettings, fmtMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n";
import { useStatement } from "@/lib/month-end";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Khoyoot" },
      { name: "description", content: "Income, expenses and monthly profit & loss for Khoyoot." },
      { property: "og:title", content: "Finance — Khoyoot" },
      { property: "og:description", content: "Income, expenses and monthly profit & loss for Khoyoot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

const today = new Date().toISOString().slice(0, 10);

function FinancePage() {
  const roles = useRoles();
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const base = useAppSettings().data?.base_currency ?? "MYR";
  const money = (value: number | string | null | undefined) => fmtMoney(value, base);
  const catsQ = useExpenseCategories();
  const cats = catsQ.data ?? [];
  const qc = useQueryClient();
  const thisMonth = monthRange(0);

  const [month, setMonth] = useState(thisMonth.start.slice(0, 7));
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
  const statement = useStatement(month, roles.isOwner);
  const [category, setCategory] = useState<string>("all");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [editIncome, setEditIncome] = useState<any>(null);
  const [delTarget, setDelTarget] = useState<{ kind: "expenses" | "income"; id: string } | null>(null);

  const enabled = roles.isOwner;

  const expensesQ = useQuery({
    queryKey: ["expenses", from, to],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const incomeQ = useQuery({
    queryKey: ["income", from, to],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const summaryQ = useQuery({
    queryKey: ["dash-summary", month], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_summary", { _month: from });
      if (error) throw error;
      return data as unknown as { months: { month: string; revenue: number; order_profit: number; losses: number; net_profit: number; shared_costs: number; unallocated: number }[] };
    },
  });

  const addExpense = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("expenses").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Expense recorded"));
      setExpenseOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addIncome = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("income").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Income recorded"));
      setIncomeOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown>) => {
      const { error } = await supabase.from("expenses").update(payload as never).eq("id", id as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Expense updated"));
      setEditExpense(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateIncome = useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown>) => {
      const { error } = await supabase.from("income").update(payload as never).eq("id", id as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Income updated"));
      setEditIncome(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRow = useMutation({
    mutationFn: async ({ kind, id }: { kind: "expenses" | "income"; id: string }) => {
      const { error } = await supabase.from(kind).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Deleted"));
      setDelTarget(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = summaryQ.data?.months.find(m => m.month === month);
  const pnl = { revenue: Number(summary?.revenue ?? 0), orderProfit: Number(summary?.order_profit ?? 0), losses: Number(summary?.losses ?? 0), shared: Number(summary?.shared_costs ?? 0), unallocated: Number(summary?.unallocated ?? 0), net: Number(summary?.net_profit ?? 0) };

  const filteredExpenses = (expensesQ.data ?? []).filter(
    (e: any) => category === "all" || e.category === category,
  );

  if (!roles.isLoading && !roles.isOwner) {
    return <AccessDenied message={tt("Financial records are limited to the Owner / Finance role.")} />;
  }

  const pnlRows: [string, number][] = [
    [tt("Revenue (orders)"), pnl.revenue],
    [t("fin_orderProfit"), pnl.orderProfit],
    [t("fin_losses"), -pnl.losses],
    [t("fin_unallocated"), pnl.unallocated],
    [tt("Net profit"), pnl.net],
    [t("fin_sharedSeparate"), pnl.shared],
  ];
  const pnlTitle = `${tt("ex_pnlTitle")} ${from} → ${to}`;
  const exportPnlCsv = () =>
    downloadCsv(`pnl-${from}_${to}.csv`, [tt("ex_line"), tt("ex_amount")], pnlRows.map(([l, v]) => [l, v.toFixed(2)]));
  const exportPnlPdf = () =>
    printReport(pnlTitle, [{ heading: pnlTitle, headers: [tt("ex_line"), tt("ex_amount")], rows: pnlRows.map(([l, v]) => [l, money(v)]) }], lang);

  return (
    <div>
      <PageHeader
        title={tt("Finance")}
        description={tt("Income, expenses and profit & loss.")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportPnlCsv}>{tt("ex_csv")}</Button>
            <Button variant="outline" onClick={exportPnlPdf}>{tt("ex_pdf")}</Button>
            <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">{tt("Add income")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{tt("Record income")}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    addIncome.mutate({
                      entry_date: String(f.get("entry_date")),
                      ...readMoney(f),
                      source: String(f.get("source")),
                      notes: String(f.get("notes") || "") || null,
                    });
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="i-date">{tt("Date")}</Label>
                      <Input id="i-date" name="entry_date" type="date" defaultValue={today} required />
                    </div>
                  </div>
                  <MoneyFields idPrefix="i" />
                  <div className="space-y-2">
                    <Label htmlFor="i-source">{tt("Source")}</Label>
                    <Input id="i-source" name="source" defaultValue="sale" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="i-notes">{tt("Notes")}</Label>
                    <Textarea id="i-notes" name="notes" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={addIncome.isPending}>{tt("Save")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
              <DialogTrigger asChild>
                <Button>{tt("Add expense")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{tt("Record expense")}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    addExpense.mutate({
                      entry_date: String(f.get("entry_date")),
                      ...readMoney(f),
                      category: String(f.get("category")),
                      description: String(f.get("description") || "") || null,
                    });
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="e-date">{tt("Date")}</Label>
                      <Input id="e-date" name="entry_date" type="date" defaultValue={today} required />
                    </div>
                  </div>
                  <MoneyFields idPrefix="e" />
                  <div className="space-y-2">
                    <Label htmlFor="e-cat">{tt("Category")}</Label>
                    <select
                      id="e-cat"
                      name="category"
                      defaultValue={cats.find((c) => c.code === "other") ? "other" : cats[0]?.code}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {cats.map((c) => (
                        <option key={c.code} value={c.code}>
                          {categoryLabel(cats, c.code, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e-desc">{tt("Description")}</Label>
                    <Textarea id="e-desc" name="description" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={addExpense.isPending}>{tt("Save")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="finance-month">{t("month")}</Label>
            <Input id="finance-month" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tt("Expense category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tt("All categories")}</SelectItem>
                {cats.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {categoryLabel(cats, c.code, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">{tt("Profit & Loss")}</TabsTrigger>
          <TabsTrigger value="expenses">{tt("Expenses")}</TabsTrigger>
          <TabsTrigger value="income">{tt("Income")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="mt-4">
          {(summaryQ.error || statement.error) && <p role="alert" className="text-destructive">{summaryQ.error?.message ?? statement.error?.message}</p>}
          {summaryQ.isLoading && <p>{t("loading")}</p>}

          <Card>
            <CardHeader>
              <CardTitle>
                {formatDate(from)} — {formatDate(to)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {pnlRows.filter(([label]) => label !== tt("Net profit")).map(([label, value]) => (
                    <TableRow key={label}><TableCell>{label}</TableCell><TableCell className="text-end tabular-nums">{money(value)}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>{tt("Net profit")}</TableCell>
                    <TableCell
                      className={`text-end tabular-nums ${pnl.net >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {money(pnl.net)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="mt-5">
            <h2 className="mb-3 font-display text-xl">{t("me_finalThisMonth")}</h2>
            <div className="grid gap-3 sm:grid-cols-3">{statement.data?.partners.map(p => <div key={p.partner_id} className="border-s-2 border-primary ps-3"><p className="font-medium">{p.name}</p><p>{t("me_final")}: {money(p.final)}</p><p className={p.remaining < 0 ? "text-destructive" : "text-primary"}>{p.remaining < 0 ? t("me_paysIn") : t("me_takes")} {money(Math.abs(p.remaining))}</p></div>)}</div>
            <p className="mt-3 text-sm text-muted-foreground">{t("cap_returned")}: {money(statement.data?.capital_return)} · {t("cap_reserve")}: {money(statement.data?.reserve_kept)} · {statement.data?.closed ? t("me_closed") : t("me_live")}</p>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("Date")}</TableHead>
                    <TableHead>{tt("Category")}</TableHead>
                    <TableHead>{tt("Description")}</TableHead>
                    <TableHead className="text-end">{tt("Amount")}</TableHead>
                    <TableHead className="text-end">{tt("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.entry_date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{categoryLabel(cats, e.category, lang)}</Badge>
                      </TableCell>
                      <TableCell className="rtl-content">{e.description ?? "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{money(e.base_amount ?? e.amount)}{e.currency && e.currency !== base ? <span className="block text-xs text-muted-foreground">{e.currency} {Number(e.amount).toFixed(2)}</span> : null}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={tt("Edit")} onClick={() => e.is_shared ? navigate({ to: "/shared-expenses" }) : setEditExpense(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={tt("Delete")} onClick={() => setDelTarget({ kind: "expenses", id: e.id })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {tt("No expenses in this range.")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("Date")}</TableHead>
                    <TableHead>{tt("Source")}</TableHead>
                    <TableHead>{tt("Notes")}</TableHead>
                    <TableHead className="text-end">{tt("Amount")}</TableHead>
                    <TableHead className="text-end">{tt("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(incomeQ.data ?? []).map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{formatDate(i.entry_date)}</TableCell>
                      <TableCell>{tt(titleCase(i.source))}</TableCell>
                      <TableCell className="rtl-content">{i.notes ?? "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{money(i.base_amount ?? i.amount)}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={tt("Edit")} onClick={() => setEditIncome(i)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={tt("Delete")} onClick={() => setDelTarget({ kind: "income", id: i.id })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(incomeQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {tt("No income entries in this range.")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editExpense} onOpenChange={(v) => !v && setEditExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt("Edit expense")}</DialogTitle>
          </DialogHeader>
          {editExpense && (
            <form
              key={editExpense.id}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                updateExpense.mutate({
                  id: editExpense.id,
                  entry_date: String(f.get("entry_date")),
                  ...readMoney(f),
                  category: String(f.get("category")),
                  description: String(f.get("description") || "") || null,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ee-date">{tt("Date")}</Label>
                <Input id="ee-date" name="entry_date" type="date" defaultValue={editExpense.entry_date} required />
              </div>
              <MoneyFields idPrefix="ee" defaultAmount={editExpense.amount} defaultCurrency={editExpense.currency} defaultFx={editExpense.fx_rate_to_base} />
              <div className="space-y-2">
                <Label htmlFor="ee-cat">{tt("Category")}</Label>
                <select id="ee-cat" name="category" defaultValue={editExpense.category} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {cats.map((c) => (
                    <option key={c.code} value={c.code}>{categoryLabel(cats, c.code, lang)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ee-desc">{tt("Description")}</Label>
                <Textarea id="ee-desc" name="description" defaultValue={editExpense.description ?? ""} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateExpense.isPending}>{tt("Save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editIncome} onOpenChange={(v) => !v && setEditIncome(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt("Edit income")}</DialogTitle>
          </DialogHeader>
          {editIncome && (
            <form
              key={editIncome.id}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                updateIncome.mutate({
                  id: editIncome.id,
                  entry_date: String(f.get("entry_date")),
                  ...readMoney(f),
                  source: String(f.get("source")),
                  notes: String(f.get("notes") || "") || null,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ei-date">{tt("Date")}</Label>
                <Input id="ei-date" name="entry_date" type="date" defaultValue={editIncome.entry_date} required />
              </div>
              <MoneyFields idPrefix="ei" defaultAmount={editIncome.amount} defaultCurrency={editIncome.currency} defaultFx={editIncome.fx_rate_to_base} />
              <div className="space-y-2">
                <Label htmlFor="ei-source">{tt("Source")}</Label>
                <Input id="ei-source" name="source" defaultValue={editIncome.source} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ei-notes">{tt("Notes")}</Label>
                <Textarea id="ei-notes" name="notes" defaultValue={editIncome.notes ?? ""} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateIncome.isPending}>{tt("Save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!delTarget}
        onOpenChange={(v) => !v && setDelTarget(null)}
        onConfirm={() => delTarget && deleteRow.mutate(delTarget)}
      />
    </div>
  );
}
