import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("November includes October unpaid obligations without requiring October closure", () => {
  const query = `select pg_get_functiondef('public.month_statement(date)'::regprocedure) as definition`;
  const response = JSON.parse(execFileSync("lovable", ["supabase", "query", "--json", query], { encoding: "utf8" }));
  const definition = response.rows[0].definition;
  expect(definition).toContain("prev:=public.month_statement((start_date-interval '1 month')::date)");
  expect(definition).toContain("carry:=COALESCE((prior->>'remaining')::numeric,0)");
  expect(definition).toContain("'carry_provisional',true");
});