import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Khoyoot — Business Operating System" },
      {
        name: "description",
        content: "Sign in to the Khoyoot operating system: inventory, orders, finance and marketing.",
      },
      { property: "og:title", content: "Khoyoot — Business Operating System" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Sign in to the Khoyoot operating system: inventory, orders, finance and marketing.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="tatreez-band h-2 w-28 rounded-full" />
      <h1 className="font-display text-3xl text-foreground">Khoyoot</h1>
      <p className="text-sm text-muted-foreground">Preparing your workspace…</p>
    </div>
  );
}
