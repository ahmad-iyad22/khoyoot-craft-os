import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useRoles } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** "Pending approval" / "Rejected" tag; renders nothing for approved rows. */
export function ApprovalTag({ status }: { status?: string | null }) {
  const { t } = useI18n();
  if (!status || status === "approved") return null;
  return (
    <Badge variant="outline" className={status === "rejected" ? "border-destructive/50 bg-destructive/15 text-destructive" : "border-warning/50 bg-warning/20 text-warning-foreground"}>
      {status === "rejected" ? t("ap_rejected") : t("ap_pending")}
    </Badge>
  );
}

/** Number of items waiting for approval (Owner only). */
export function usePendingCount() {
  const { isOwner } = useRoles();
  return useQuery({
    queryKey: ["approvals-count"],
    enabled: isOwner,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("expenses").select("id", { count: "exact", head: true }).eq("approval_status" as never, "pending" as never),
        supabase.from("partner_transactions").select("id", { count: "exact", head: true }).eq("approval_status" as never, "pending" as never),
      ]);
      return (a.count ?? 0) + (b.count ?? 0);
    },
  });
}

/** Owner settings: threshold, approvals needed, and which login belongs to which partner. */
export function ApprovalSettings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["approval-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("id, approval_threshold, approvals_required").maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const partnersQ = useQuery({
    queryKey: ["partners-link"],
    queryFn: async () => {
      const [p, pr] = await Promise.all([
        supabase.from("partners").select("id, name, profile_id").order("created_at"),
        supabase.from("profiles").select("id, email, full_name"),
      ]);
      if (p.error) throw p.error;
      return { partners: p.data ?? [], profiles: pr.data ?? [] };
    },
  });
  const [th, setTh] = useState("");
  const [req, setReq] = useState("2");
  useEffect(() => {
    if (settingsQ.data) {
      setTh(String(settingsQ.data.approval_threshold ?? 0));
      setReq(String(settingsQ.data.approvals_required ?? 2));
    }
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").update({ approval_threshold: Number(th) || 0, approvals_required: Math.max(1, Math.floor(Number(req) || 1)) } as never).eq("id", settingsQ.data.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries({ queryKey: ["approval-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const link = useMutation({
    mutationFn: async (v: { id: string; profile: string | null }) => {
      const { error } = await supabase.from("partners").update({ profile_id: v.profile } as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners-link"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="card-surface space-y-4 p-4">
      <div>
        <h3 className="font-display text-lg">{t("ap_settingsTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("ap_settingsHelp")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="ap-th">{t("ap_threshold")}</Label>
          <Input id="ap-th" type="number" min="0" step="0.01" value={th} onChange={(e) => setTh(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ap-req">{t("ap_required")}</Label>
          <Input id="ap-req" type="number" min="1" step="1" value={req} onChange={(e) => setReq(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={() => save.mutate()} disabled={!settingsQ.data || save.isPending}>{t("save")}</Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("ap_linkTitle")}</p>
        {(partnersQ.data?.partners ?? []).map((p: any) => (
          <div key={p.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="w-24 text-sm">{p.name}</span>
            <select
              aria-label={p.name}
              value={p.profile_id ?? ""}
              onChange={(e) => link.mutate({ id: p.id, profile: e.target.value || null })}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("ap_noLogin")}</option>
              {(partnersQ.data?.profiles ?? []).map((pr: any) => (
                <option key={pr.id} value={pr.id}>{pr.full_name ? `${pr.full_name} · ${pr.email}` : pr.email}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
