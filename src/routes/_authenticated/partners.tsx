import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { tt, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/partners")({
  head: () => ({
    meta: [
      { title: "Partners — Khoyoot" },
      { name: "description", content: "Partner capital contributions, withdrawals and running balances." },
      { property: "og:title", content: "Partners — Khoyoot" },
      {
        property: "og:description",
        content: "Partner capital contributions, withdrawals and running balances.",
      },
    ],
  }),
  component: PartnersPage,
});

const today = new Date().toISOString().slice(0, 10);

function PartnersPage() {
  const roles = useRoles();
  const qc = useQueryClient();
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [txnFor, setTxnFor] = useState<any | null>(null);

  const partnersQ = useQuery({
    queryKey: ["partners"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*, partner_transactions(*)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addPartner = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("partners").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Partner added"));
      setPartnerOpen(false);
      qc.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTxn = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("partner_transactions").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tt("Transaction recorded"));
      setTxnFor(null);
      qc.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!roles.isLoading && !roles.isOwner) {
    return <AccessDenied message={tt("Partner capital records are limited to the Owner / Finance role.")} />;
  }

  const balanceOf = (p: any) =>
    (p.partner_transactions ?? []).reduce(
      (s: number, t: any) => s + (t.txn_type === "withdrawal" ? -Number(t.amount) : Number(t.amount)),
      0,
    );

  return (
    <div>
      <PageHeader
        title={tt("Partners")}
        description={tt("Capital contributions, withdrawals and running balances.")}
        action={
          <Dialog open={partnerOpen} onOpenChange={setPartnerOpen}>
            <DialogTrigger asChild>
              <Button>{tt("Add partner")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tt("Add partner")}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  addPartner.mutate({
                    name: String(f.get("name")),
                    share_percent: Number(f.get("share_percent") || 0),
                    notes: String(f.get("notes") || "") || null,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="p-name">{tt("Name")}</Label>
                  <Input id="p-name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-share">Share %</Label>
                  <Input id="p-share" name="share_percent" type="number" step="0.01" defaultValue={33.33} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-notes">{tt("Notes")}</Label>
                  <Textarea id="p-notes" name="notes" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addPartner.isPending}>{tt("Save")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {(partnersQ.data ?? []).map((p: any) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl">{p.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Share {Number(p.share_percent)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tt("Balance")}</p>
                <p className="font-display text-2xl">{money(balanceOf(p))}</p>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("Date")}</TableHead>
                    <TableHead>{tt("Type")}</TableHead>
                    <TableHead className="text-right">{tt("Amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(p.partner_transactions ?? [])]
                    .sort((a: any, b: any) => (a.txn_date < b.txn_date ? 1 : -1))
                    .map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.txn_date)}</TableCell>
                        <TableCell>
                          <Badge variant={t.txn_type === "withdrawal" ? "destructive" : "secondary"}>
                            {t.txn_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(t.amount)}</TableCell>
                      </TableRow>
                    ))}
                  {(p.partner_transactions ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {tt("No transactions yet.")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setTxnFor(p)}>
                {tt("Add transaction")}
              </Button>
            </CardContent>
          </Card>
        ))}
        {(partnersQ.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">{tt("No partners yet — add the three partners to start.")}</p>
        )}
      </div>

      <Dialog open={!!txnFor} onOpenChange={(o) => !o && setTxnFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction — {txnFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              addTxn.mutate({
                partner_id: txnFor.id,
                txn_type: String(f.get("txn_type")),
                amount: Number(f.get("amount")),
                txn_date: String(f.get("txn_date")),
                notes: String(f.get("notes") || "") || null,
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-type">{tt("Type")}</Label>
                <select
                  id="t-type"
                  name="txn_type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="contribution">{tt("Contribution")}</option>
                  <option value="withdrawal">{tt("Withdrawal")}</option>
                  <option value="profit_share">{tt("Profit share")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-amount">{tt("Amount")}</Label>
                <Input id="t-amount" name="amount" type="number" step="0.01" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-date">{tt("Date")}</Label>
              <Input id="t-date" name="txn_date" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-notes">{tt("Notes")}</Label>
              <Textarea id="t-notes" name="notes" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addTxn.isPending}>{tt("Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
