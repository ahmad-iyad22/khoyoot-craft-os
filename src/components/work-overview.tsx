import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

const SOON_DAYS = 7;
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="font-display text-2xl tabular-nums">{value}</div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: { id: string; name: string; sub: string }[]; tone: string }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <span className={`size-2 rounded-full ${tone}`} />{title}<Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">{t("wo_none")}</p> : (
        <ul className="space-y-1">
          {items.slice(0, 5).map((i) => (
            <li key={i.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{i.name}</span><span className="shrink-0 text-xs text-muted-foreground">{i.sub}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PENDING = "border-muted bg-muted/50";
const PROGRESS = "border-info/40 bg-info/15";
const DONE = "border-success/40 bg-success/15";
const LATE = "border-destructive/40 bg-destructive/15";
const SOON = "border-warning/40 bg-warning/20";

/** Dashboard overview of team tasks, marketing tasks and campaigns. Read-only; edits happen on Tasks/Marketing pages. */
export function WorkOverview() {
  const { t } = useI18n();
  const roles = useRoles();
  const tasksQ = useQuery({ queryKey: ["wo-tasks"], queryFn: async () => {
    const { data, error } = await supabase.from("tasks").select("*");
    if (error) throw error; return data ?? [];
  } });
  const campQ = useQuery({ queryKey: ["campaigns"], enabled: roles.isMarketing, queryFn: async () => {
    const { data, error } = await supabase.from("campaigns").select("*").order("end_date");
    if (error) throw error; return data ?? [];
  } });
  const costsQ = useQuery({ queryKey: ["marketing-costs"], enabled: roles.isOwner, queryFn: async () => {
    const { data, error } = await supabase.from("expenses").select("*").not("campaign_id", "is", null);
    if (error) throw error; return data ?? [];
  } });

  const now = today(); const soon = inDays(SOON_DAYS);
  const all = (tasksQ.data ?? []) as any[];
  const stats = (rows: any[]) => ({
    todo: rows.filter((r) => r.status === "todo").length,
    prog: rows.filter((r) => r.status === "in_progress").length,
    done: rows.filter((r) => r.status === "done").length,
    late: rows.filter((r) => r.status !== "done" && r.due_date && r.due_date < now),
  });
  const team = stats(all.filter((r) => !r.is_marketing));
  const mkt = stats(all.filter((r) => r.is_marketing));

  const camps = (campQ.data ?? []) as any[];
  const spent = new Map<string, number>();
  for (const e of (costsQ.data ?? []) as any[]) spent.set(e.campaign_id, (spent.get(e.campaign_id) ?? 0) + Number(e.base_amount ?? 0));
  const ended = (c: any) => c.status === "completed" || (c.end_date && c.end_date < now);
  const notStarted = camps.filter((c) => !ended(c) && (c.status === "planned" || (c.start_date && c.start_date > now)));
  const running = camps.filter((c) => !ended(c) && !notStarted.includes(c));
  const finished = camps.filter(ended);
  const endingSoon = running.filter((c) => c.end_date && c.end_date <= soon);
  const overBudget = camps.filter((c) => Number(c.budget) > 0 && (spent.get(c.id) ?? 0) > Number(c.budget));
  const renew = camps.filter((c) => c.end_date && c.end_date < now && c.end_date >= inDays(-14) );
  const lst = (rows: any[], sub: (c: any) => string) => rows.map((c) => ({ id: c.id, name: c.name ?? c.title, sub: sub(c) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[{ key: "wo_team", s: team, to: "/tasks" as const }, ...(roles.isMarketing ? [{ key: "wo_mktTasks", s: mkt, to: "/marketing" as const }] : [])].map(({ key, s, to }) => (
        <Card key={key}>
          <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="font-display text-lg">{t(key)}</CardTitle><Link to={to} className="text-sm text-primary hover:underline">{t("wo_manage")}</Link></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label={t("taskPending")} value={s.todo} tone={PENDING} />
              <Tile label={t("taskInProgress")} value={s.prog} tone={PROGRESS} />
              <Tile label={t("taskCompleted")} value={s.done} tone={DONE} />
              <Tile label={t("wo_overdue")} value={s.late.length} tone={LATE} />
            </div>
            <List title={t("wo_overdue")} tone="bg-destructive" items={lst(s.late, (r) => formatDate(r.due_date))} />
          </CardContent>
        </Card>
      ))}
      {roles.isMarketing && (
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="font-display text-lg">{t("wo_campaigns")}</CardTitle><Link to="/marketing" className="text-sm text-primary hover:underline">{t("wo_manage")}</Link></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label={t("wo_notStarted")} value={notStarted.length} tone={PENDING} />
              <Tile label={t("wo_running")} value={running.length} tone={PROGRESS} />
              <Tile label={t("wo_finished")} value={finished.length} tone={DONE} />
              <Tile label={t("wo_endingSoon")} value={endingSoon.length} tone={SOON} />
              <Tile label={t("wo_overBudget")} value={overBudget.length} tone={LATE} />
              <Tile label={t("wo_renew")} value={renew.length} tone={SOON} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <List title={t("wo_endingSoon")} tone="bg-warning" items={lst(endingSoon, (c) => formatDate(c.end_date))} />
              <List title={t("wo_overBudget")} tone="bg-destructive" items={lst(overBudget, (c) => `${Math.round(spent.get(c.id) ?? 0)} / ${Math.round(Number(c.budget))}`)} />
              <List title={t("wo_renew")} tone="bg-warning" items={lst(renew, (c) => formatDate(c.end_date))} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
