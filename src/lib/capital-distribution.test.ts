import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("500 profit repays 100 each to Ahmad and Nur before reserving 30 and sharing 270", () => {
  const query = `select public.capital_distribution(600-100,100,10,'[{"partner_id":"Ahmad","contributed":100,"outstanding":100},{"partner_id":"Nur","contributed":100,"outstanding":100}]'::jsonb) as result`;
  const response = JSON.parse(execFileSync("lovable", ["supabase", "query", "--json", query], { encoding: "utf8" }));
  const result = response.rows[0].result;
  expect(result.capital_return).toBe(200);
  expect(result.reserve_kept).toBe(30);
  expect(result.distributable).toBe(270);
  expect(result.partners.map((p: { capital_returned: number }) => p.capital_returned)).toEqual([100, 100]);
  expect(result.distributable * 25 / 100).toBe(67.5);
  expect(result.distributable * 50 / 100 + 100).toBe(235);
});