import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PartnerStatement = {
  partner_id: string; name: string; profit_share: number; loss_share: number; item_cost_owed: number;
  paid_on_behalf: number; owed_to_them: number; they_owe: number; withdrawals: number; carry_in: number;
  final: number; settled: number; remaining: number;
};
export type Statement = {
  month: string; closed: boolean; closed_at: string | null; previous_closed: boolean; unallocated_profit: number;
  partners: PartnerStatement[];
  cash: { available: number; pending_payouts: number; payouts: number; shortfall: number };
};

export function useStatement(month: string, enabled = true) {
  return useQuery({
    queryKey: ["month-statement", month],
    enabled,
    queryFn: async (): Promise<Statement> => {
      const { data, error } = await supabase.rpc("month_statement" as never, { _month: `${month}-01` } as never);
      if (error) throw error;
      return data as unknown as Statement;
    },
  });
}

export function useBalances(enabled = true) {
  return useQuery({
    queryKey: ["bank-balances"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_account_balances" as never).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);
