import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "operations" | "marketing";

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner / Finance",
  operations: "Inventory / Operations",
  marketing: "Marketing",
};

export function useUser() {
  return useQuery({
    queryKey: ["auth-user"],
    queryFn: async (): Promise<User | null> => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
}

export function useRoles() {
  const { data: user } = useUser();
  const userId = user?.id;
  const query = useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
    staleTime: 60_000,
  });

  const roles = query.data ?? [];
  const isOwner = roles.includes("owner");
  return {
    roles,
    isLoading: query.isLoading,
    isOwner,
    isOperations: isOwner || roles.includes("operations"),
    isMarketing: isOwner || roles.includes("marketing"),
    primaryRole: (isOwner ? "owner" : (roles[0] ?? null)) as AppRole | null,
  };
}

/** Keeps react-query in sync with sign-in / sign-out. */
export function useAuthSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
}
