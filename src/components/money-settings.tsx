import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAppSettings } from "@/lib/money";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CurrencySettings({ canEdit }: { canEdit: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const s = useAppSettings().data;
  const save = useMutation({
    mutationFn: async (v: { base_currency: string; currencies: string[] }) => {
      const { error } = await supabase.from("app_settings").update({ ...v, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!s) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("currencies")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          key={s.base_currency + s.currencies.join()}
          className="grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const base = String(f.get("base")).trim().toUpperCase();
            const list = String(f.get("list"))
              .split(/[,\s]+/)
              .map((x) => x.trim().toUpperCase())
              .filter(Boolean);
            if (!/^[A-Z]{3}$/.test(base) || list.some((c) => !/^[A-Z]{3}$/.test(c))) {
              toast.error(t("currencyCodeInvalid"));
              return;
            }
            save.mutate({ base_currency: base, currencies: Array.from(new Set([base, ...list])) });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cur-base">{t("baseCurrency")}</Label>
            <Input id="cur-base" name="base" defaultValue={s.base_currency} maxLength={3} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur-list">{t("supportedCurrencies")}</Label>
            <Input id="cur-list" name="list" defaultValue={s.currencies.join(", ")} disabled={!canEdit} />
          </div>
          {canEdit && <Button type="submit" disabled={save.isPending}>{t("save")}</Button>}
        </form>
        <p className="mt-3 text-xs text-muted-foreground">{t("currencyHint")}</p>
      </CardContent>
    </Card>
  );
}

const FEE_FIELDS = [
  { key: "commission_percent", label: "commissionPct", step: "0.001" },
  { key: "transaction_fee_percent", label: "transactionFeePct", step: "0.001" },
  { key: "fixed_fee", label: "fixedFeePerOrder", step: "0.01" },
  { key: "sst_percent", label: "sstPct", step: "0.001" },
] as const;

export function CapitalSettings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const s = useAppSettings().data;
  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const capital_return_percent_of_profit = Number(f.get("capital"));
      const reserve_percent = Number(f.get("reserve"));
      if (![capital_return_percent_of_profit, reserve_percent].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error(t("cap_invalid"));
      const { error } = await supabase.from("app_settings").update({ capital_return_percent_of_profit, reserve_percent }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("saved")); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!s) return null;
  return <Card><CardHeader><CardTitle className="text-lg">{t("cap_settings")}</CardTitle></CardHeader><CardContent>
    <form key={`${s.capital_return_percent_of_profit}-${s.reserve_percent}`} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
      <div className="space-y-2"><Label htmlFor="cap-rate">{t("cap_rate")}</Label><Input id="cap-rate" name="capital" type="number" min="0" max="100" step="0.01" required defaultValue={s.capital_return_percent_of_profit ?? 100} /></div>
      <div className="space-y-2"><Label htmlFor="cap-reserve">{t("cap_reserveRate")}</Label><Input id="cap-reserve" name="reserve" type="number" min="0" max="100" step="0.01" required defaultValue={s.reserve_percent ?? 0} /></div>
      <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
    </form>
  </CardContent></Card>;
}

export function PlatformFeesSettings({ canEdit }: { canEdit: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<string | null>(null);
  const feesQ = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_fees").select("*").order("platform");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["platform-fees"] });
  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("platform_fees").update({ ...v.patch, updated_at: new Date().toISOString() } as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const add = useMutation({
    mutationFn: async (platform: string) => {
      const { error } = await supabase.from("platform_fees").insert({ platform, fee_percent: 0 } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_fees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("platformFeesTab")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>{t("platform")}</TableHead>
              {FEE_FIELDS.map((f) => (
                <TableHead key={f.key}>{t(f.label)}</TableHead>
              ))}
              <TableHead>{t("waiverUntil")}</TableHead>
              <TableHead>{t("notes")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(feesQ.data ?? []).map((row: any) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Input
                    className="w-32"
                    defaultValue={row.platform}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== row.platform && update.mutate({ id: row.id, patch: { platform: e.target.value.trim() } })}
                  />
                </TableCell>
                {FEE_FIELDS.map((f) => (
                  <TableCell key={f.key}>
                    <Input
                      type="number"
                      min="0"
                      step={f.step}
                      className="w-24"
                      disabled={!canEdit}
                      defaultValue={Number(row[f.key] ?? 0)}
                      onBlur={(e) => Number(e.target.value) !== Number(row[f.key]) && update.mutate({ id: row.id, patch: { [f.key]: Math.max(0, Number(e.target.value || 0)) } })}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Input
                    type="date"
                    className="w-40"
                    disabled={!canEdit}
                    defaultValue={row.waiver_until ?? ""}
                    onBlur={(e) => (e.target.value || null) !== row.waiver_until && update.mutate({ id: row.id, patch: { waiver_until: e.target.value || null } })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-48"
                    dir="auto"
                    disabled={!canEdit}
                    defaultValue={row.note ?? ""}
                    onBlur={(e) => (e.target.value.trim() || null) !== row.note && update.mutate({ id: row.id, patch: { note: e.target.value.trim() || null } })}
                  />
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={() => setToDelete(row.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("platform") || "").trim();
              if (name) add.mutate(name);
              e.currentTarget.reset();
            }}
          >
            <Input name="platform" placeholder={t("newPlatformName")} className="max-w-xs" dir="auto" />
            <Button type="submit">
              <Plus className="size-4" /> {t("addPlatform")}
            </Button>
          </form>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("platformFeesHint")}</p>
        <ConfirmDelete
          open={!!toDelete}
          onOpenChange={(v) => !v && setToDelete(null)}
          onConfirm={() => {
            if (toDelete) del.mutate(toDelete);
            setToDelete(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
