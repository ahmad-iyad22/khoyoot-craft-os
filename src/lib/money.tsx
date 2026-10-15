import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AppSettings = { base_currency: string; currencies: string[] };

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from("app_settings").select("base_currency, currencies").maybeSingle();
      if (error) throw error;
      return data ?? { base_currency: "MYR", currencies: ["MYR"] };
    },
    staleTime: 60_000,
  });
}

export type ExpenseCategory = { id: string; code: string; label: string; label_ar: string | null; is_shared: boolean };

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: async (): Promise<ExpenseCategory[]> => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("label");
      if (error) throw error;
      return (data ?? []) as ExpenseCategory[];
    },
  });
}

export function categoryLabel(cats: ExpenseCategory[] | undefined, code: string, lang: string) {
  const c = cats?.find((x) => x.code === code);
  if (!c) return code.replace(/_/g, " ");
  return lang === "ar" ? c.label_ar || c.label : c.label;
}

export function fmtMoney(value: number | string | null | undefined, currency: string) {
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Amount + currency + rate-to-base inputs. Emits form fields amount, currency, fx_rate_to_base. */
export function MoneyFields({
  defaultAmount,
  defaultCurrency,
  defaultFx,
  idPrefix,
}: {
  defaultAmount?: number | string | null;
  defaultCurrency?: string | null;
  defaultFx?: number | string | null;
  idPrefix: string;
}) {
  const { t } = useI18n();
  const settings = useAppSettings().data;
  const base = settings?.base_currency ?? "MYR";
  const [amount, setAmount] = useState(String(defaultAmount ?? ""));
  const [currency, setCurrency] = useState(defaultCurrency ?? base);
  const [fx, setFx] = useState(String(defaultFx ?? 1));
  const isBase = currency === base;
  const converted = Number(amount || 0) * (isBase ? 1 : Number(fx || 0));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-amount`}>{t("amount")}</Label>
          <Input id={`${idPrefix}-amount`} name="amount" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-cur`}>{t("currency")}</Label>
          <select
            id={`${idPrefix}-cur`}
            name="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              if (e.target.value === base) setFx("1");
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {(settings?.currencies ?? [base]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      {isBase ? (
        <input type="hidden" name="fx_rate_to_base" value="1" />
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-fx`}>{t("fxRate").replace("{cur}", currency).replace("{base}", base)}</Label>
          <Input id={`${idPrefix}-fx`} name="fx_rate_to_base" type="number" step="0.000001" min="0.000001" required value={fx} onChange={(e) => setFx(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {t("convertedAmount")}: {fmtMoney(converted, base)}
          </p>
        </div>
      )}
    </div>
  );
}

export function readMoney(f: FormData) {
  const amount = Number(f.get("amount") || 0);
  const fx = Number(f.get("fx_rate_to_base") || 1);
  return {
    amount,
    currency: String(f.get("currency") || "MYR"),
    fx_rate_to_base: fx,
    base_amount: Math.round(amount * fx * 100) / 100,
  };
}
