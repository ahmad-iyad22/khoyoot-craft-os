import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "user" | "assistant"; content: string; imageDataUrl?: string };

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

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway key is not configured");

    const langInstruction =
      data.language === "ar"
        ? "Reply fully in Arabic."
        : "Reply in English.";

    const systemPrompt = `You are the AI Manager of Khoyoot, an internal business operating system for a small Palestinian heritage-goods business run by three partners (Ahmad and Nur in Malaysia, May in Palestine who makes the products). Sales happen on TikTok Shop, Shopee and Lazada.

You are READ-ONLY: you analyze and recommend, but you can never change data, prices, or settings. If asked to change something, explain that the user must do it in the app.

Your job: analyze the live business data below and give practical, specific advice — profitable products, reorder needs, whether to ship now or wait, best posting times, partner balances, profit-split scenarios, margin concerns. Use the actual numbers. Be concise and concrete. When data is missing for a question, say so.

The user may attach photos (for example to count pieces in a box, check stock on a shelf, or read a receipt or invoice). Analyze the attached photo carefully: when asked to count, count precisely and state what you counted and the number; when reading text, quote the relevant figures. Combine what you see in the photo with the live data below.

${langInstruction}

Live business data (JSON):
${businessData}`;

    const recent = data.messages.slice(-12);
    const input: any[] = [{ role: "system", content: systemPrompt }];
    for (const m of recent) {
      if (m.role === "user" && m.imageDataUrl) {
        const url = m.imageDataUrl;
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(url) || url.length > 9_000_000) {
          throw new Error("Unsupported or oversized attached image");
        }
        input.push({
          role: "user",
          content: [
            { type: "input_text", text: m.content || "" },
            { type: "input_image", image_url: url },
          ],
        });
      } else {
        input.push({ role: m.role, content: m.content });
      }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input,
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      throw new Error(`AI request failed (${res.status})`);
    }

    // Consume the SSE stream and accumulate the answer text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        for (const line of evt.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
              reply += parsed.delta;
            } else if (parsed.type === "response.failed" || parsed.type === "error") {
              throw new Error(parsed.error?.message ?? "AI stream failed");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
    if (!reply) throw new Error("AI returned an empty reply");
    return { reply };
  });
