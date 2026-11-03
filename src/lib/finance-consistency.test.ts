import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("Finance monthly totals equal Dashboard totals and partner payouts use Month-end", () => {
  const query = `with caller as materialized (select set_config('request.jwt.claim.sub',(select user_id::text from public.user_roles where role='owner' order by user_id limit 1),true) uid), months as (select ('2026-10-01'||left(uid,0))::date m from caller union all select ('2026-11-01'||left(uid,0))::date from caller) select public.dashboard_summary(m) dashboard, public.partner_month_summary(m) partner_summary, public.month_statement(m) statement from months`;
  const response = JSON.parse(execFileSync("lovable", ["supabase", "query", "--json", query], { encoding: "utf8" }));
  expect(response.rows).toHaveLength(2);
  for (const row of response.rows) {
    const monthly = row.dashboard.months.find((m: { month: string }) => m.month === row.statement.month);
    expect(monthly).toBeDefined();
    expect(Number(monthly.order_profit)).toBe(Number(row.partner_summary.order_profit));
    expect(Number(monthly.losses)).toBe(Number(row.partner_summary.losses));
    const allocated = row.partner_summary.partners.reduce((n: number, p: { net_share: number }) => n + Number(p.net_share), 0);
    expect(Number(monthly.net_profit)).toBeCloseTo(allocated, 2);
    expect(row.statement.partners.length).toBeGreaterThan(0);
    for (const p of row.statement.partners) expect(Number(p.remaining)).toBeCloseTo(Number(p.final) - Number(p.settled), 2);
  }
});