import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  Wallet,
  ShoppingCart,
  Users,
  Truck,
  Megaphone,
  CheckSquare,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  Languages,
} from "lucide-react";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useRoles, useUser } from "@/lib/auth";
import { tt, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  show: (r: ReturnType<typeof useRoles>) => boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, show: () => true },
  { to: "/inventory", labelKey: "inventory", icon: Package, show: (r) => r.isOperations },
  { to: "/orders", labelKey: "orders", icon: ShoppingCart, show: (r) => r.isOperations },
  { to: "/finance", labelKey: "finance", icon: Wallet, show: (r) => r.isOwner },
  { to: "/partners", labelKey: "partners", icon: Users, show: (r) => r.isOwner },
  { to: "/suppliers", labelKey: "suppliers", icon: Truck, show: (r) => r.isOperations },
  { to: "/marketing", labelKey: "marketing", icon: Megaphone, show: (r) => r.isMarketing },
  { to: "/tasks", labelKey: "tasks", icon: CheckSquare, show: () => true },
  { to: "/settings", labelKey: "settings", icon: SettingsIcon, show: () => true },
];

function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-lg bg-sidebar-accent/40 p-1">
      <Languages className="mx-1 size-4 shrink-0 text-sidebar-foreground/60" />
      {(["en", "ar"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            lang === code
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
          )}
        >
          {code === "en" ? t("english") : t("arabic")}
        </button>
      ))}
    </div>
  );
}


function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-2 rounded-lg bg-sidebar-accent/40 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {theme === "dark" ? t("light") : t("dark")}
    </button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const roles = useRoles();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((item) => item.show(roles)).map((item) => {
        const active = pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { data: user } = useUser();
  const { primaryRole } = useRoles();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground">
      <div>
        <div className="tatreez-band mb-3 h-1.5 w-16 rounded-full" />
        <p className="font-display text-2xl leading-none">{t("appName")}</p>
        <p className="mt-1 text-xs text-sidebar-foreground/55">{t("tagline")} · {tt("Phase 1 · Internal use only")}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavLinks onNavigate={onNavigate} />
      </div>

      <div className="space-y-3 border-t border-sidebar-border pt-4">
        <LanguageToggle />
        <ThemeToggle />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user?.email}</p>
          {primaryRole && (
            <Badge variant="secondary" className="mt-1 text-[11px]">
              {ROLE_LABELS[primaryRole]}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" /> {t("signOut")}
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarInner />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarInner onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-display text-lg">{t("appName")}</span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="card-surface mx-auto mt-16 max-w-md p-8 text-center">
      <h2 className="font-display text-xl">{tt("Not available for your role")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? tt("Ask the Owner if you need access to this section.")}
      </p>
    </div>
  );
}
