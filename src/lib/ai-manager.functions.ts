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
    name: "find_products",
    description: "Search products by name or SKU. Returns ids and key fields so you never guess an id. Read-only.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "name or SKU fragment" } },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "find_orders",
    description: "Search orders by date, platform, customer name or order reference. Read-only.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        platform: { type: "string" },
        customer: { type: "string" },
        reference: { type: "string", description: "order number / reference" },
      },
    },
  },
  {
    type: "function",
    name: "find_expenses",
    description: "Search expenses by date, category or description. Read-only.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        category: { type: "string" },
        description: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "find_shipments",
    description: "Search shipments by reference or stage/status. Read-only.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string" },
        stage: { type: "string", description: "e.g. preparing, in_transit, customs, arrived_in_malaysia" },
      },
    },
  },
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
        category: { type: "string", description: "category name (existing categories only)" },
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
    name: "create_product",
    description: "Create a product. The SKU is generated automatically from the category prefix; never accept a typed SKU.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        category: { type: "string", description: "category name (existing categories only)" },
        sale_price: { type: "number" },
        weight_grams: { type: "number" },
        notes: { type: "string" },
      },
      required: ["name", "category"],
    },
  },
  {
    type: "function",
    name: "delete_product",
    description: "Delete a product by SKU, only if it was never used in a shipment, order or batch. Otherwise it is archived instead and you explain why.",
    parameters: {
      type: "object",
      properties: { sku: { type: "string" } },
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

type ToolResult = { summary: string; old?: Record<string, unknown>; silent?: boolean };

const clean = (s: unknown) => String(s ?? "").replace(/[,%()]/g, " ").trim();

async function findCategory(sb: any, name: string) {
  const { data } = await sb.from("categories").select("id, name, name_ar, prefix_code");
  const n = String(name).toLowerCase().trim();
  const exact = (data ?? []).filter(
    (c: any) => c.name.toLowerCase() === n || (c.name_ar && String(c.name_ar).trim() === String(name).trim()),
  );
  const hits = exact.length ? exact : (data ?? []).filter((c: any) => c.name.toLowerCase().includes(n));
  if (hits.length !== 1) throw new Error(`Category "${name}" not found or ambiguous`);
  return hits[0] as { id: string; name: string; prefix_code: string | null };
}

async function runTool(sb: any, name: string, a: any): Promise<ToolResult> {
  switch (name) {
    case "find_products": {
      const q = clean(a.query);
      if (!q) throw new Error("query required");
      const { data, error } = await sb
        .from("products")
        .select("id, sku, name, sale_price, stock_qty, status, archived, weight_grams, categories(name)")
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(20);
      if (error) throw new Error(error.message);
      return { summary: JSON.stringify(data ?? []), silent: true };
    }
    case "find_orders": {
      let q = sb
        .from("orders")
        .select("id, order_number, order_date, platform, customer_name, status, platform_fee, shipping_cost")
        .order("order_date", { ascending: false })
        .limit(20);
      if (a.date) q = q.eq("order_date", a.date);
      if (a.platform) q = q.ilike("platform", `%${clean(a.platform)}%`);
      if (a.customer) q = q.ilike("customer_name", `%${clean(a.customer)}%`);
      if (a.reference) q = q.ilike("order_number", `%${clean(a.reference)}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { summary: JSON.stringify(data ?? []), silent: true };
    }
    case "find_expenses": {
      let q = sb
        .from("expenses")
        .select("id, entry_date, category, description, amount, currency, base_amount, is_shared")
        .order("entry_date", { ascending: false })
        .limit(20);
      if (a.date) q = q.eq("entry_date", a.date);
      if (a.category) q = q.ilike("category", `%${clean(a.category)}%`);
      if (a.description) q = q.ilike("description", `%${clean(a.description)}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { summary: JSON.stringify(data ?? []), silent: true };
    }
    case "find_shipments": {
      let q = sb
        .from("shipments")
        .select("id, reference, status, total_shipping_cost, customs_cost, currency, created_at, received_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (a.reference) q = q.ilike("reference", `%${clean(a.reference)}%`);
      if (a.stage) q = q.ilike("status", `%${clean(a.stage)}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { summary: JSON.stringify(data ?? []), silent: true };
    }
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
      const { data: newId, error } = await sb.rpc("save_shared_expense", {
        _id: null,
        _e: { entry_date: a.date, category: a.category, description: a.description, paid_by_business: business, paid_by_partner_id: payer?.id ?? null, split_mode: mode, campaign_id: null, shipment_id: null, receipt_path: null, ...mm },
        _splits: splits,
      });
      if (error) throw new Error(error.message);
      const pend = await pendingNote(sb, "expenses", newId as unknown as string);
      return { summary: `Added expense ${fmt(mm.amount, mm.currency)} (${a.category}) paid by ${payer?.name ?? "business"}, ${mode} split${pend}` };
    }
    case "add_partner_transaction": {
      const mm = m(a);
      const p = await findPartner(sb, a.partner);
      const { data: row, error } = await sb.from("partner_transactions").insert({ partner_id: p.id, txn_type: a.type, txn_date: a.date, notes: a.notes || null, receipt_path: null, ...mm }).select("id").single();
      if (error) throw new Error(error.message);
      const pend = await pendingNote(sb, "partner_transactions", row.id);
      return { summary: `Added ${a.type} ${fmt(mm.amount, mm.currency)} for ${p.name} on ${a.date}${pend}` };
    }
    case "update_product": {
      const { data: prod } = await sb.from("products").select("*").eq("sku", a.sku).maybeSingle();
      if (!prod) throw new Error(`Product ${a.sku} not found`);
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "sale_price", "weight_grams", "notes", "min_stock"]) if (a[k] !== undefined && a[k] !== null) patch[k] = a[k];
      if (a.category) patch["category_id"] = (await findCategory(sb, a.category)).id;
      if (!Object.keys(patch).length) throw new Error("Nothing to change");
      const { error } = await sb.from("products").update(patch).eq("id", prod.id);
      if (error) throw new Error(error.message);
      const old: Record<string, unknown> = {};
      for (const k of Object.keys(patch)) old[k] = (prod as any)[k];
      return { summary: `Updated ${a.sku}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`, old };
    }
    case "create_product": {
      const pname = String(a.name || "").trim();
      if (!pname) throw new Error("Product name required");
      const cat = await findCategory(sb, a.category);
      if (!cat.prefix_code) throw new Error(`Category "${cat.name}" has no SKU prefix`);
      const { data: sku, error: skuErr } = await sb.rpc("claim_next_sku", { _code: cat.prefix_code });
      if (skuErr) throw new Error(skuErr.message);
      const { error } = await sb.from("products").insert({
        sku: String(sku),
        name: pname,
        category_id: cat.id,
        sale_price: Math.max(0, Number(a.sale_price) || 0),
        weight_grams: Math.max(0, Number(a.weight_grams) || 0),
        notes: a.notes ? String(a.notes) : null,
      });
      if (error) throw new Error(error.message);
      return { summary: `Created product "${pname}" with SKU ${sku} (category ${cat.name})` };
    }
    case "delete_product": {
      const { data: prod } = await sb.from("products").select("*").eq("sku", a.sku).maybeSingle();
      if (!prod) throw new Error(`Product ${a.sku} not found`);
      const [oi, si, ib] = await Promise.all([
        sb.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", prod.id),
        sb.from("shipment_items").select("id", { count: "exact", head: true }).eq("product_id", prod.id),
        sb.from("inventory_batches").select("id", { count: "exact", head: true }).eq("product_id", prod.id),
      ]);
      const used = (oi.count ?? 0) + (si.count ?? 0) + (ib.count ?? 0);
      if (used > 0) {
        if (!prod.archived) {
          const { error } = await sb.from("products").update({ archived: true }).eq("id", prod.id);
          if (error) throw new Error(error.message);
        }
        return {
          summary: `${a.sku} is used in ${used} order/shipment/batch record(s), so it was archived instead of deleted`,
          old: { archived: prod.archived },
        };
      }
      const { error } = await sb.from("products").delete().eq("id", prod.id);
      if (error) throw new Error(error.message);
      return { summary: `Deleted product ${a.sku} ("${prod.name}")`, old: prod as Record<string, unknown> };
    }
    case "archive_product": {
      const { data: prod } = await sb.from("products").select("id, archived").eq("sku", a.sku).maybeSingle();
      if (!prod) throw new Error(`Product ${a.sku} not found`);
      const { error } = await sb.from("products").update({ archived: !!a.archived }).eq("id", prod.id);
      if (error) throw new Error(error.message);
      return { summary: `${a.archived ? "Archived" : "Restored"} ${a.sku}`, old: { archived: prod.archived } };
    }
    case "set_platform_fee": {
      const patch: Record<string, unknown> = {};
      for (const k of ["commission_percent", "transaction_fee_percent", "fixed_fee", "sst_percent"]) if (typeof a[k] === "number") patch[k] = a[k];
      if (a.waiver_until !== undefined) patch["waiver_until"] = a.waiver_until || null;
      if (!Object.keys(patch).length) throw new Error("Nothing to change");
      const { data: oldRow } = await sb.from("platform_fees").select("*").ilike("platform", a.platform).maybeSingle();
      if (!oldRow) throw new Error(`Platform ${a.platform} not found`);
      const { error } = await sb.from("platform_fees").update(patch).eq("id", oldRow.id);
      if (error) throw new Error(error.message);
      const old: Record<string, unknown> = {};
      for (const k of Object.keys(patch)) old[k] = (oldRow as any)[k];
      return { summary: `Updated ${oldRow.platform} fees: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`, old };
    }
    case "add_bank_transaction": {
      const mm = m(a);
      const acc = await findAccount(sb, a.account);
      const note = a.note ? String(a.note).trim() : null;
      let q = sb.from("bank_transactions").select("id").eq("account_id", acc.id).eq("txn_date", a.date).eq("amount", mm.amount);
      q = note ? q.eq("note", note) : q.is("note", null);
      const { data: dup } = await q.limit(1);
      if (dup?.length) return { summary: `SKIPPED duplicate: ${acc.name} ${a.date} ${fmt(mm.amount, mm.currency)}${note ? ` "${note}"` : ""}` };
      const { error } = await sb.from("bank_transactions").insert({ account_id: acc.id, to_account_id: null, txn_type: a.type, txn_date: a.date, note, receipt_path: null, ...mm });
      if (error) throw new Error(error.message);
      return { summary: `Added ${a.type} ${fmt(mm.amount, mm.currency)} to ${acc.name} on ${a.date}${note ? ` "${note}"` : ""}` };
    }
    case "record_balance_check": {
      const acc = await findAccount(sb, a.account);
      const actual = Number(a.actual_balance);
      if (!Number.isFinite(actual)) throw new Error("actual_balance must be a number");
      const { data: prev } = await sb.from("bank_accounts").select("actual_balance, actual_checked_at").eq("id", acc.id).maybeSingle();
      const { error } = await sb.from("bank_accounts").update({ actual_balance: actual, actual_checked_at: a.date }).eq("id", acc.id);
      if (error) throw new Error(error.message);
      const { data: bal } = await sb.from("bank_account_balances").select("balance_native").eq("id", acc.id).maybeSingle();
      const sys = Number(bal?.balance_native ?? 0);
      const diff = Math.round((actual - sys) * 100) / 100;
      return {
        summary: `Balance check ${acc.name} on ${a.date}: actual ${fmt(actual, acc.currency)}, system ${fmt(sys, acc.currency)}, difference ${fmt(diff, acc.currency)}`,
        old: { actual_balance: prev?.actual_balance ?? null, actual_checked_at: prev?.actual_checked_at ?? null },
      };
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

ACTIONS: When the Owner explicitly instructs you (typed, or from a photo of a receipt/invoice), perform the action directly with your tools — no confirmation step — then report exactly what you did with the numbers. You can add shared expenses, add partner transactions, edit products (name, category, sale price, weight, notes, min stock), create products (the SKU is generated automatically from the category — never accept a typed SKU), delete products that were never used in a shipment/order/batch (otherwise archive and explain), archive/restore products, update platform fees, add bank transactions and record bank balance checks. You also have read-only search tools (find_products, find_orders, find_expenses, find_shipments) that return ids and key fields — use them before acting so you never guess an id, and if several records match, ask which one. You can NEVER hard delete anything, and never change SKUs, stock, orders or shipments. NEVER invent numbers: if an amount, currency rate, partner, product, category, account or date is missing or ambiguous, ask ONE short question instead of acting. Rates, prices and fees change all the time — never assume fixed values; use only what the user gave or what is in the data. Profit shares are set per shipment, not per partner. Only act on explicit instructions; for questions just analyze.
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
    let toolCalls = 0;
    for (let i = 0; i < 10; i++) {
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
        if (++toolCalls > 30) {
          input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify({ ok: false, error: "Tool call limit (30) reached for this message; not executed" }) });
          continue;
        }
        let args: any = {};
        let result: any;
        try {
          args = JSON.parse(c.arguments || "{}");
          const r = await runTool(supabase, c.name, args);
          result = { ok: true, summary: r.summary, ...(r.old !== undefined ? { old: r.old } : {}) };
          if (!r.silent) {
            actions.push({ tool: c.name, summary: r.summary, ok: true });
            await supabase.from("ai_action_log").insert({ user_id: userId, tool: c.name, args, result });
          }
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
        input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(result) });
      }
    }
    return { reply: "", actions };
  });

/** Large-expense rule: report "pending approval, needs N approvals" when the database marked the new row pending. */
async function pendingNote(sb: any, table: "expenses" | "partner_transactions", id: string): Promise<string> {
  if (!id) return "";
  const { data } = await sb.from(table).select("approval_status").eq("id", id).maybeSingle();
  if (data?.approval_status !== "pending") return "";
  const { data: st } = await sb.from("app_settings").select("approvals_required").maybeSingle();
  return ` — pending approval, needs ${st?.approvals_required ?? 2} approvals from other partners before it counts`;
}
