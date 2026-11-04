import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useRoles, useUser } from "@/lib/auth";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { ApprovalTag } from "@/components/approvals";
import { TatreezEmptyState } from "@/components/tatreez";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Pending approvals · Khoyoot" },
      { name: "description", content: "Approve or reject large expenses before they count." },
      { property: "og:title", content: "Pending approvals · Khoyoot" },
      { property: "og:description", content: "Approve or reject large expenses before they count." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});

type Item = { kind: "expense" | "partner_txn"; id: string; date: string; label: string; amount: number; status: string; creator: string | null; payer: string | null };

function ApprovalsPage() {
  const { t } = useI18n();
  const roles = useRoles();
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["approvals"],
    enabled: roles.isOwner,
    queryFn: async () => {
      const [e, p, ap, parts, st] = await Promise.all([
        supabase.from("expenses").select("id, entry_date, category, description, base_amount, amount, approval_status, created_by, paid_by_partner_id").in("approval_status" as never, ["pending", "rejected"] as never).order("entry_date", { ascending: false }),
        supabase.from("partner_transactions").select("id, txn_date, txn_type, notes, base_amount, amount, approval_status, created_by, partner_id").in("approval_status" as never, ["pending", "rejected"] as never).order("txn_date", { ascending: false }),
        supabase.from("expense_approvals" as never).select("*"),
        supabase.from("partners").select("id, name, profile_id"),
        supabase.from("app_settings").select("approvals_required").maybeSingle(),
      ]);
      for (const r of [e, p, ap, parts]) if (r.error) throw r.error;
      const items: Item[] = [
        ...((e.data ?? []) as any[]).map((x) => ({ kind: "expense" as const, id: x.id, date: x.entry_date, label: [x.category, x.description].filter(Boolean).join(" · "), amount: Number(x.base_amount ?? x.amount), status: x.approval_status, creator: x.created_by, payer: x.paid_by_partner_id })),
        ...((p.data ?? []) as any[]).map((x) => ({ kind: "partner_txn" as const, id: x.id, date: x.txn_date, label: [t(`txn_${x.txn_type}`), x.notes].filter(Boolean).join(" · "), amount: Number(x.base_amount ?? x.amount), status: x.approval_status, creator: x.created_by, payer: x.partner_id })),
      ];
      return { items, approvals: (ap.data ?? []) as any[], partners: (parts.data ?? []) as any[], required: (st.data as any)?.approvals_required ?? 2 };
    },
  });

  const decide = useMutation({
    mutationFn: async (v: { item: Item; decision: "approve" | "reject" }) => {
      const { error } = await supabase.rpc("decide_approval" as never, { _kind: v.item.kind, _id: v.item.id, _decision: v.decision, _comment: comments[v.item.id] || null } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      for (const k of ["approvals", "approvals-count", "month-statement", "dashboard-summary", "shared-expenses"]) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => {
      const m = e.message;
      toast.error(m.includes("APPROVAL_OWN") ? t("ap_errOwn") : m.includes("APPROVAL_NOT_LINKED") ? t("ap_errLink") : m.includes("APPROVAL_CLOSED") ? t("ap_errClosed") : m);
    },
  });

  if (!roles.isLoading && !roles.isOwner) return <AccessDenied />;
  const data = q.data;
  const me = data?.partners.find((p) => p.profile_id === user?.id);
  const name = (id: string) => data?.partners.find((p) => p.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title={t("ap_title")} description={t("ap_subtitle")} />
      {!me && data && <p className="mb-4 rounded-md border border-warning/50 bg-warning/15 p-3 text-sm">{t("ap_errLink")}</p>}
      {data && data.items.length === 0 && <TatreezEmptyState title={t("ap_empty")} />}
      <div className="space-y-3">
        {data?.items.map((it) => {
          const votes = data.approvals.filter((a) => a.record_kind === it.kind && a.record_id === it.id);
          const ok = votes.filter((v) => v.decision === "approve").length;
          const own = it.creator === user?.id || (me && it.payer === me.id);
          return (
            <div key={it.kind + it.id} className="card-surface space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium" dir="auto">{it.label || "—"}</p>
                  <p className="text-xs text-muted-foreground">{it.date} · {it.kind === "expense" ? t("ap_kindExpense") : `${t("ap_kindTxn")} · ${name(it.payer ?? "")}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{it.amount.toFixed(2)}</span>
                  <ApprovalTag status={it.status} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("ap_progress").replace("{n}", String(ok)).replace("{r}", String(data.required))}
                {votes.length > 0 && " · " + votes.map((v) => `${name(v.partner_id)}: ${v.decision === "approve" ? "✓" : "✗"}${v.comment ? ` (${v.comment})` : ""}`).join(", ")}
              </p>
              {it.status === "pending" && (
                own ? <p className="text-xs text-muted-foreground">{t("ap_errOwn")}</p> : me && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input placeholder={t("ap_comment")} value={comments[it.id] ?? ""} onChange={(e) => setComments({ ...comments, [it.id]: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide.mutate({ item: it, decision: "approve" })} disabled={decide.isPending}><Check className="size-4" /> {t("ap_approve")}</Button>
                      <Button size="sm" variant="destructive" onClick={() => decide.mutate({ item: it, decision: "reject" })} disabled={decide.isPending}><X className="size-4" /> {t("ap_reject")}</Button>
                    </div>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
