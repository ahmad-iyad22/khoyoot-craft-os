import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { money } from "@/lib/format";
import { monthOptions } from "@/lib/ledger";
import { currentMonth, useBalances, useStatement } from "@/lib/month-end";

/** Dashboard cards: each partner's final month result, and bank/cash totals. Owner only. */
export function MonthEndCards() {
  const { t } = useI18n();
  const [month, setMonth] = useState(currentMonth());
  const st = useStatement(month);
  const bal = useBalances().data ?? [];
  const sum = (f: (b: any) => boolean, k: string) => bal.filter(f).reduce((s, b) => s + Number(b[k] ?? 0), 0);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card-surface space-y-2 p-4 text-sm lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg">{t("me_finalThisMonth")}</p>
          <select aria-label={t("me_month")} value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(st.data?.partners ?? []).map((p) => (
            <div key={p.partner_id} className="rounded-lg border p-3">
              <p className="font-medium">{p.name}</p>
              <p className={"font-display text-xl " + (Number(p.remaining) < 0 ? "text-destructive" : "text-primary")}>
                {Number(p.remaining) < 0 ? t("me_paysIn") : t("me_takes")} {money(Math.abs(Number(p.remaining)))}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{st.data?.closed ? t("me_closed") : t("me_live")}</span>
          <Link to="/month-end" className="font-medium text-primary underline">{t("me_seeDetails")}</Link>
        </div>
      </div>
      <div className="card-surface space-y-2 p-4 text-sm">
        <p className="font-display text-lg">{t("bankCash")}</p>
        <div className="flex justify-between"><span>{t("bk_businessBalance")}</span><span>{money(sum((b) => b.kind === "business_bank", "balance_base"))}</span></div>
        <div className="flex justify-between"><span>{t("bk_totalCash")}</span><span>{money(sum((b) => b.kind !== "platform_wallet", "balance_base"))}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>{t("bk_pendingTotal")}</span><span>{money(sum((b) => b.kind === "platform_wallet", "pending_payout"))}</span></div>
        <Link to="/bank" className="text-xs font-medium text-primary underline">{t("bankCash")}</Link>
      </div>
    </div>
  );
}
