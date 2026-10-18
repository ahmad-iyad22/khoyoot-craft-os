import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "user" | "assistant"; content: string; imageDataUrl?: string };

async function gatherBusinessContext(supabase: any): Promise<string> {
  const month = new Date().toISOString().slice(0, 8) + "01";
  const [products, orders, shipments, partners, expenses, income, analytics, partnerMonth, expCats, fees] = await Promise.all([
    supabase
      .from("products")
      .select("sku, name, sale_price, avg_cost, stock_qty, min_stock, status, weight_grams")
      .eq("archived", false)
      .limit(200),
    supabase
      .from("orders")
      .select("order_date, platform, status, shipping_cost, platform_fee, order_items(quantity, sale_price, unit_cost)")
      .order("order_date", { ascending: false })
      .limit(100),
    supabase
      .from("shipments")
      .select("reference, status, total_shipping_cost, customs_cost, total_paid_weight_kg, currency")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("partners").select("name, expense_share_percent, active, location").limit(20),
    supabase
      .from("expenses")
      .select("entry_date, category, amount, currency, base_amount, is_shared")
      .order("entry_date", { ascending: false })
      .limit(100),
    supabase
      .from("income")
      .select("entry_date, source, amount, currency, base_amount")
      .order("entry_date", { ascending: false })
      .limit(100),
    supabase
      .from("platform_analytics")
      .select("platform, snapshot_date, views, orders, revenue, ad_spend")
      .order("snapshot_date", { ascending: false })
      .limit(60),
    supabase.rpc("partner_month_summary", { _month: month }),
    supabase.from("expense_categories").select("code, label"),
    supabase.from("platform_fees").select("platform, commission_percent, transaction_fee_percent, fixed_fee, sst_percent, waiver_until"),
  ]);

  const ctx = {
    products: products.data ?? [],
    recentOrders: orders.data ?? [],
    shipments: shipments.data ?? [],
    partners: partners.data ?? [],
    recentExpenses: expenses.data ?? [],
    recentIncome: income.data ?? [],
    platformAnalytics: analytics.data ?? [],
    partnerMonthSummaryCurrentMonth: partnerMonth.data ?? null,
    expenseCategories: expCats.data ?? [],
    platformFees: fees.data ?? [],
  };
  return JSON.stringify(ctx);
}

const money = {
  amount: { type: "number" },
  currency: { type: "string", description: "Currency code, default MYR" },
  fx_rate_to_base: { type: "number", description: "Rate to MYR for that date; 1 when MYR. Ask if unknown." },
};
const TOOLS = [
  {
    type: "function",
    name: "add_shared_expense",
    description: "Record a shared business expense split between partners.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        category: { type: "string", description: "expense category code" },
        description: { type: "string" },
        ...money,
        paid_by: { type: "string", description: "partner name or 'business'" },
        split_percents: {
          type: "object",
          description: "Optional map partner name -> percent totalling 100. Omit for equal split.",
          additionalProperties: { type: "number" },
        },
      },
      required: ["date", "category", "description", "amount", "paid_by"],
    },
  },
  {
    type: "function",
    name: "add_partner_transaction",
    description: "Record a partner withdrawal, contribution or paid-on-behalf entry.",
    parameters: {
      type: "object",
      properties: {
        partner: { type: "string" },
        type: { type: "string", enum: ["withdrawal", "contribution", "paid_on_behalf"] },
        ...money,
        date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
      },
      required: ["partner", "type", "amount", "date"],
    },
  },
  {
    type: "function",
    name: "update_product",
    description: "Edit a product by SKU. Never changes SKU or stock.",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string" },
        name: { type: "string" },
        sale_price: { type: "number" },
        weight_grams: { type: "number" },
        notes: { type: "string" },
        min_stock: { type: "integer" },
      },
      required: ["sku"],
    },
  },
  {
    type: "function",
    name: "archive_product",
    description: "Archive (true) or restore (false) a product by SKU. No hard delete.",
    parameters: {
      type: "object",
      properties: { sku: { type: "string" }, archived: { type: "boolean" } },
      required: ["sku", "archived"],
    },
  },
  {
    type: "function",
    name: "set_platform_fee",
    description: "Update a platform's fee settings.",
    parameters: {
      type: "object",
      properties: {
        platform: { type: "string" },
        commission_percent: { type: "number" },
        transaction_fee_percent: { type: "number" },
        fixed_fee: { type: "number" },
        sst_percent: { type: "number" },
        waiver_until: { type: "string", description: "YYYY-MM-DD or empty to clear" },
      },
      required: ["platform"],
    },
  },
  {
    type: "function",
    name: "add_bank_transaction",
    description: "Add one bank/cash transaction row (e.g. from a GXBank screenshot). Duplicates (same account, date, amount, note) are skipped.",
    parameters: {
      type: "object",
      properties: {
        account: { type: "string", description: "bank account name" },
        type: { type: "string", enum: ["deposit", "platform_payout", "withdrawal", "expense_payment", "adjustment"] },
        date: { type: "string", description: "YYYY-MM-DD" },
        ...money,
        note: { type: "string" },
      },
      required: ["account", "type", "date", "amount"],
    },
  },
  {
    type: "function",
    name: "record_balance_check",
    description: "Record the actual balance shown by the bank for an account.",
    parameters: {
      type: "object",
      properties: { account: { type: "string" }, actual_balance: { type: "number" }, date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["account", "actual_balance", "date"],
    },
  },
];

async function findAccount(sb: any, name: string) {
  const { data } = await sb.from("bank_accounts").select("id, name, currency");
  const n = String(name).toLowerCase().trim();
  const exact = (data ?? []).filter((a: any) => a.name.toLowerCase() === n);
  const hits = exact.length ? exact : (data ?? []).filter((a: any) => a.name.toLowerCase().includes(n));
  if (hits.length !== 1) throw new Error(`Bank account "${name}" not found or ambiguous`);
  return hits[0] as { id: string; name: string; currency: string };
}

type Action = { tool: string; summary: string; ok: boolean };

async function findPartner(sb: any, name: string) {
  const { data } = await sb.from("partners").select("id, name").eq("active", true);
  const hits = (data ?? []).filter((p: any) => p.name.toLowerCase().includes(String(name).toLowerCase().trim()));
  if (hits.length !== 1) throw new Error(`Partner "${name}" not found or ambiguous`);
  return hits[0] as { id: string; name: string };
}
function m(a: any) {
  const amount = Number(a.amount);
  if (!(amount > 0)) throw new Error("Amount must be positive");
  const currency = String(a.currency || "MYR").toUpperCase();
  const fx = currency === "MYR" ? 1 : Number(a.fx_rate_to_base);
  if (!(fx > 0)) throw new Error("fx_rate_to_base required for non-MYR currency");
  return { amount, currency, fx_rate_to_base: fx, base_amount: Math.round(amount * fx * 100) / 100 };
}
const fmt = (n: number, c: string) => `${n.toFixed(2)} ${c}`;

async function runTool(sb: any, name: string, a: any): Promise<string> {
  switch (name) {
    case "add_shared_expense": {
      const mm = m(a);
      const { data: cat } = await sb.from("expense_categories").select("code").eq("code", a.category).maybeSingle();
      if (!cat) throw new Error(`Unknown expense category "${a.category}"`);
      const business = String(a.paid_by).toLowerCase() === "business";
      const payer = business ? null : await findPartner(sb, a.paid_by);
      const { data: active } = await sb.from("partners").select("id, name").eq("active", true).order("created_at");
      const list = (active ?? []) as { id: string; name: string }[];
      let splits: { partner_id: string; percent: number }[];
      let mode = "equal";
      if (a.split_percents && Object.keys(a.split_percents).length) {
        mode = "percent";
        splits = [];
        for (const [n, pct] of Object.entries(a.split_percents)) splits.push({ partner_id: (await findPartner(sb, n)).id, percent: Number(pct) });
        const tot = splits.reduce((s, x) => s + x.percent, 0);
        if (Math.abs(tot - 100) > 0.01) throw new Error("Split must total 100%");
      } else {
        const each = Math.floor(10000 / list.length) / 100;
        splits = list.map((p, i) => ({ partner_id: p.id, percent: i === list.length - 1 ? Math.round((100 - each * (list.length - 1)) * 100) / 100 : each }));
      }
      const { error } = await sb.rpc("save_shared_expense", {
        _id: null,
        _e: { entry_date: a.date, category: a.category, description: a.description, paid_by_business: business, paid_by_partner_id: payer?.id ?? null, split_mode: mode, campaign_id: null, shipment_id: null, receipt_path: null, ...mm },
        _splits: splits,
      });
      if (error) throw new Error(error.message);
      return `Added expense ${fmt(mm.amount, mm.currency)} (${a.category}) paid by ${payer?.name ?? "business"}, ${mode} split`;
    }
    case "add_partner_transaction": {
      const mm = m(a);
      const p = await findPartner(sb, a.partner);
      const { error } = await sb.from("partner_transactions").insert({ partner_id: p.id, txn_type: a.type, txn_date: a.date, notes: a.notes || null, receipt_path: null, ...mm });
      if (error) throw new Error(error.message);
      return `Added ${a.type} ${fmt(mm.amount, mm.currency)} for ${p.name} on ${a.date}`;
    }
    case "update_product": {
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "sale_price", "weight_grams", "notes", "min_stock"]) if (a[k] !== undefined && a[k] !== null) patch[k] = a[k];
      if (!Object.keys(patch).length) throw new Error("Nothing to change");
      const { data, error } = await sb.from("products").update(patch).eq("sku", a.sku).select("sku");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(`Product ${a.sku} not found`);
      return `Updated ${a.sku}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`;
    }
    case "archive_product": {
      const { data, error } = await sb.from("products").update({ archived: !!a.archived }).eq("sku", a.sku).select("sku");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(`Product ${a.sku} not found`);
      return `${a.archived ? "Archived" : "Restored"} ${a.sku}`;
    }
    case "set_platform_fee": {
      const patch: Record<string, unknown> = {};
      for (const k of ["commission_percent", "transaction_fee_percent", "fixed_fee", "sst_percent"]) if (typeof a[k] === "number") patch[k] = a[k];
      if (a.waiver_until !== undefined) patch["waiver_until"] = a.waiver_until || null;
      if (!Object.keys(patch).length) throw new Error("Nothing to change");
      const { data, error } = await sb.from("platform_fees").update(patch).ilike("platform", a.platform).select("platform");
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(`Platform ${a.platform} not found`);
      return `Updated ${data[0].platform} fees: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`;
    }
    case "add_bank_transaction": {
      const mm = m(a);
      const acc = await findAccount(sb, a.account);
      const note = a.note ? String(a.note).trim() : null;
      let q = sb.from("bank_transactions").select("id").eq("account_id", acc.id).eq("txn_date", a.date).eq("amount", mm.amount);
      q = note ? q.eq("note", note) : q.is("note", null);
      const { data: dup } = await q.limit(1);
      if (dup?.length) return `SKIPPED duplicate: ${acc.name} ${a.date} ${fmt(mm.amount, mm.currency)}${note ? ` "${note}"` : ""}`;
      const { error } = await sb.from("bank_transactions").insert({ account_id: acc.id, to_account_id: null, txn_type: a.type, txn_date: a.date, note, receipt_path: null, ...mm });
      if (error) throw new Error(error.message);
      return `Added ${a.type} ${fmt(mm.amount, mm.currency)} to ${acc.name} on ${a.date}${note ? ` "${note}"` : ""}`;
    }
    case "record_balance_check": {
      const acc = await findAccount(sb, a.account);
      const actual = Number(a.actual_balance);
      if (!Number.isFinite(actual)) throw new Error("actual_balance must be a number");
      const { error } = await sb.from("bank_accounts").update({ actual_balance: actual, actual_checked_at: a.date }).eq("id", acc.id);
      if (error) throw new Error(error.message);
      const { data: bal } = await sb.from("bank_account_balances").select("balance_native").eq("id", acc.id).maybeSingle();
      const sys = Number(bal?.balance_native ?? 0);
      const diff = Math.round((actual - sys) * 100) / 100;
      return `Balance check ${acc.name} on ${a.date}: actual ${fmt(actual, acc.currency)}, system ${fmt(sys, acc.currency)}, difference ${fmt(diff, acc.currency)}`;
    }
  }
  throw new Error(`Unknown tool ${name}`);
}

export const askAiManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[]; language: "en" | "ar" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: isOwner } = await supabase.rpc("is_owner");
    if (!isOwner) throw new Error("Access denied: Owners only");

    const businessData = await gatherBusinessContext(supabase);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway key is not configured");

    const langInstruction = data.language === "ar" ? "Reply fully in Arabic." : "Reply in English.";
    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are the AI Manager of Khoyoot, an internal business operating system for a small Palestinian heritage-goods business run by three partners (Ahmad and Nur in Malaysia, May in Palestine who makes the products). Sales happen on TikTok Shop, Shopee and Lazada. Today is ${today}.

ACTIONS: When the Owner explicitly instructs you (typed, or from a photo of a receipt/invoice), perform the action directly with your tools — no confirmation step — then report exactly what you did with the numbers. You can add shared expenses, add partner transactions, edit products (name, sale price, weight, notes, min stock), archive/restore products, update platform fees, add bank transactions and record bank balance checks. You can NEVER hard delete anything, and never change SKUs, stock, orders or shipments. NEVER invent numbers: if an amount, currency rate, partner, product, category, account or date is missing or ambiguous, ask ONE short question instead of acting. Rates, prices and fees change all the time — never assume fixed values; use only what the user gave or what is in the data. Profit shares are set per shipment, not per partner. Only act on explicit instructions; for questions just analyze.
GXBank transaction screenshots can be entered with add_bank_transaction (one call per row; money in = deposit or platform_payout, money out = withdrawal or expense_payment; use the row's description as note); enter only rows that are clearly readable, list unreadable rows back instead of guessing, and confirm what was entered and what was skipped as duplicate.

ANALYSIS: Analyze the live data below and give practical, specific advice (profitable products, reorder needs, ship now or wait, posting times, partner balances, profit-split scenarios, margins). Use the actual numbers; say when data is missing. For attached photos, count precisely or quote the figures you read.

${langInstruction}

Live business data (JSON):
${businessData}`;

    const input: any[] = [{ role: "system", content: systemPrompt }];
    for (const m0 of data.messages.slice(-12)) {
      if (m0.role === "user" && m0.imageDataUrl) {
        const url = m0.imageDataUrl;
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(url) || url.length > 9_000_000) throw new Error("Unsupported or oversized attached image");
        input.push({ role: "user", content: [{ type: "input_text", text: m0.content || "" }, { type: "input_image", image_url: url }] });
      } else input.push({ role: m0.role, content: m0.content });
    }

    const actions: Action[] = [];
    let runId: string | undefined;
    for (let i = 0; i < 6; i++) {
      const headers: Record<string, string> = { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" };
      if (runId) headers["X-Lovable-AIG-Run-ID"] = runId;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          store: false,
          reasoning: { effort: "medium" },
          include: ["reasoning.encrypted_content"],
          tools: TOOLS,
          input,
        }),
      });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error", res.status, text);
        throw new Error(res.status === 402 ? "AI credits exhausted" : res.status === 429 ? "AI is busy, try again shortly" : `AI request failed (${res.status})`);
      }
      const out = await res.json();
      const items: any[] = out.output ?? [];
      const calls = items.filter((x) => x.type === "function_call");
      if (!calls.length) {
        const reply = items
          .filter((x) => x.type === "message")
          .flatMap((x) => x.content ?? [])
          .filter((c: any) => c.type === "output_text")
          .map((c: any) => c.text)
          .join("");
        if (!reply && !actions.length) throw new Error("AI returned an empty reply");
        return { reply, actions };
      }
      input.push(...items);
      for (const c of calls) {
        let args: any = {};
        let result: any;
        try {
          args = JSON.parse(c.arguments || "{}");
          const summary = await runTool(supabase, c.name, args);
          result = { ok: true, summary };
          actions.push({ tool: c.name, summary, ok: true });
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
        if (result.ok) await supabase.from("ai_action_log").insert({ user_id: userId, tool: c.name, args, result });
        input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(result) });
      }
    }
    return { reply: "", actions };
  });
