import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("November carries October unpaid balances even while October stays open", () => {
  const query = `with caller as materialized (select set_config('request.jwt.claim.sub',(select user_id::text from public.user_roles where role='owner' order by user_id limit 1),true) as uid) select public.month_statement(('2026-10-01' || left(uid,0))::date) as october, public.month_statement(('2026-11-01' || left(uid,0))::date) as november from caller`;
  const data = JSON.parse(execFileSync("lovable", ["supabase", "query", "--json", query], { encoding: "utf8" })).rows[0];
  expect(data.november.partners.length).toBeGreaterThan(0);
  for (const partner of data.november.partners) {
    const prior = data.october.partners.find((p: { partner_id: string }) => p.partner_id === partner.partner_id);
    expect(prior).toBeDefined();
    expect(partner.carry_in).toBe(prior.remaining);
  }
});