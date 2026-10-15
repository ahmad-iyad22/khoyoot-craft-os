import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "user" | "assistant"; content: string };

async function gatherBusinessContext(supabase: any): Promise<string> {
  const [products, orders, shipments, partners, expenses, income, analytics] = await Promise.all([
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
    supabase.from("partners").select("name, share_percent, expense_share_percent, active, location").limit(20),
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
  ]);

  const ctx = {
    products: products.data ?? [],
    recentOrders: orders.data ?? [],
    shipments: shipments.data ?? [],
    partners: partners.data ?? [],
    recentExpenses: expenses.data ?? [],
    recentIncome: income.data ?? [],
    platformAnalytics: analytics.data ?? [],
  };
  return JSON.stringify(ctx);
}

export const askAiManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[]; language: "en" | "ar" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .limit(1)
      .maybeSingle();
    if (!roleRow) throw new Error("Access denied: no role assigned");

    const businessData = await gatherBusinessContext(supabase);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway key is not configured");

    const langInstruction =
      data.language === "ar"
        ? "Reply fully in Arabic."
        : "Reply in English.";

    const systemPrompt = `You are the AI Manager of Khoyoot, an internal business operating system for a small Palestinian heritage-goods business run by three partners (Ahmad and Nur in Malaysia, May in Palestine who makes the products). Sales happen on TikTok Shop, Shopee and Lazada.

You are READ-ONLY: you analyze and recommend, but you can never change data, prices, or settings. If asked to change something, explain that the user must do it in the app.

Your job: analyze the live business data below and give practical, specific advice — profitable products, reorder needs, whether to ship now or wait, best posting times, partner balances, profit-split scenarios, margin concerns. Use the actual numbers. Be concise and concrete. When data is missing for a question, say so.

${langInstruction}

Live business data (JSON):
${businessData}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages.slice(-12),
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      throw new Error(`AI request failed (${res.status})`);
    }

    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content;
    if (!reply) throw new Error("AI returned an empty reply");
    return { reply };
  });
