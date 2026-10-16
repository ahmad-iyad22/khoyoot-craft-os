import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AccessDenied, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit log — Khoyoot" },
      { name: "description", content: "Read-only history of every change made in Khoyoot." },
      { property: "og:title", content: "Audit log — Khoyoot" },
      { property: "og:description", content: "Read-only history of every change made in Khoyoot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditLogPage,
});

const PAGE = 25;
const SKIP = new Set(["updated_at", "created_at"]);

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function Diff({ oldD, newD }: { oldD: any; newD: any }) {
  const keys = [...new Set([...Object.keys(oldD ?? {}), ...Object.keys(newD ?? {})])].filter((k) => !SKIP.has(k));
  const changed = keys.filter((k) => JSON.stringify(oldD?.[k]) !== JSON.stringify(newD?.[k]));
  const list = oldD && newD ? changed : keys;
  if (!list.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5 text-xs">
      {list.slice(0, 12).map((k) => (
        <li key={k} className="break-all" dir="auto">
          <span className="font-medium">{k}</span>:{" "}
          {oldD && <span className="text-destructive line-through">{show(oldD[k])}</span>}
          {oldD && newD && " → "}
          {newD && <span className="text-success">{show(newD[k])}</span>}
        </li>
      ))}
    </ul>
  );
}

function AuditLogPage() {
  const roles = useRoles();
  const { t } = useI18n();
  const [table, setTable] = useState("");
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const usersQ = useQuery({
    queryKey: ["audit-users"],
    enabled: roles.isOwner,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });
  const q = useQuery({
    queryKey: ["audit", table, action, user, from, to, page],
    enabled: roles.isOwner,
    queryFn: async () => {
      let r = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (table) r = r.eq("table_name", table);
      if (action) r = r.eq("action", action);
      if (user) r = r.eq("user_id", user);
      if (from) r = r.gte("created_at", from);
      if (to) r = r.lt("created_at", new Date(new Date(to).getTime() + 864e5).toISOString());
      const { data, error, count } = await r.range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      const list = data ?? [];
      let ai: { user_id: string; created_at: string }[] = [];
      if (list.length) {
        const ts = list.map((x) => new Date(x.created_at).getTime());
        const { data: a } = await supabase.from("ai_action_log").select("user_id, created_at")
          .gte("created_at", new Date(Math.min(...ts) - 5000).toISOString())
          .lte("created_at", new Date(Math.max(...ts) + 5000).toISOString());
        ai = a ?? [];
      }
      const byAi = new Set(list.filter((x) => ai.some((y) => y.user_id === x.user_id && Math.abs(new Date(y.created_at).getTime() - new Date(x.created_at).getTime()) <= 5000)).map((x) => x.id));
      return { rows: list, count: count ?? 0, byAi };
    },
  });

  if (!roles.isOwner) return <AccessDenied />;
  const users = usersQ.data ?? [];
  const name = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name || u?.email || "—";
  };
  const rows = q.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE));
  const reset = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(0); };
  const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

  return (
    <div className="space-y-4">
      <PageHeader title={t("auditLog")} description={t("al_subtitle")} />
      <div className="card-surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label>{t("al_table")}</Label>
          <Input value={table} onChange={(e) => reset(setTable)(e.target.value.trim())} placeholder="orders" dir="ltr" />
        </div>
        <div className="space-y-1">
          <Label>{t("al_action")}</Label>
          <select className={sel} value={action} onChange={(e) => reset(setAction)(e.target.value)}>
            <option value="">{t("al_all")}</option>
            {["INSERT", "UPDATE", "DELETE"].map((a) => <option key={a} value={a}>{t(`al_${a}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{t("al_user")}</Label>
          <select className={sel} value={user} onChange={(e) => reset(setUser)(e.target.value)}>
            <option value="">{t("al_all")}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{t("al_from")}</Label>
          <Input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t("al_to")}</Label>
          <Input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("al_when")}</th>
              <th className="px-4 py-3 text-start">{t("al_user")}</th>
              <th className="px-4 py-3 text-start">{t("al_table")}</th>
              <th className="px-4 py-3 text-start">{t("al_action")}</th>
              <th className="px-4 py-3 text-start">{t("al_changes")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="whitespace-nowrap px-4 py-3">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {name(r.user_id)}
                  {q.data?.byAi.has(r.id) && <Badge variant="outline" className="ms-2 text-[10px]">{t("al_byAi")}</Badge>}
                </td>
                <td className="px-4 py-3" dir="ltr">{r.table_name}</td>
                <td className="px-4 py-3">
                  <Badge variant={r.action === "DELETE" ? "destructive" : "secondary"}>{t(`al_${r.action}`)}</Badge>
                </td>
                <td className="px-4 py-3">
                  {r.summary && <p className="mb-1 text-xs" dir="auto">{r.summary}</p>}
                  <Diff oldD={r.old_data} newD={r.new_data} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("al_empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("al_prev")}</Button>
        <span className="text-sm text-muted-foreground">{page + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t("al_next")}</Button>
      </div>
    </div>
  );
}
