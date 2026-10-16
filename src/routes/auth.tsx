import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { tt, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle, ThemeToggle } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Khoyoot" },
      { name: "description", content: "Sign in to the Khoyoot business operating system." },
      { property: "og:title", content: "Sign in — Khoyoot" },
      { property: "og:description", content: "Sign in to the Khoyoot business operating system." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="tatreez-band h-3 w-40 rounded-full" />
        <div>
          <h1 className="font-display text-5xl leading-tight">{tt("Khoyoot")}</h1>
          <p className="mt-2 font-display text-2xl text-sidebar-primary" dir="rtl">
            خيوط
          </p>
          <p className="mt-6 max-w-sm text-sm text-sidebar-foreground/75">
            {tt("One place for stock, orders, money, partners and marketing — built around the way three partners actually run a heritage craft business.")}
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">{tt("Phase 1 · Internal use only")}</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex gap-2 rounded-lg bg-sidebar p-1 text-sidebar-foreground"><div className="flex-1"><LanguageToggle /></div><div className="w-28"><ThemeToggle /></div></div>
          <div className="mb-8 lg:hidden">
            <div className="tatreez-band mb-4 h-2 w-24 rounded-full" />
            <h1 className="font-display text-3xl">{tt("Khoyoot")}</h1>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="signin">{tt("Sign in")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{tt("Email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tt("you@khoyoot.com")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tt("Password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("signingIn") : tt("Sign in")}
                </Button>
              </form>
            </TabsContent>


          </Tabs>
        </div>
      </div>
    </div>
  );
}
