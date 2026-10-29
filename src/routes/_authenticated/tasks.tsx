import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { tt, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, titleCase } from "@/lib/format";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Check, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Khoyoot" },
      { name: "description", content: "Shared task list for the Khoyoot team with owners and due dates." },
      { property: "og:title", content: "Tasks — Khoyoot" },
      { property: "og:description", content: "Shared task list with owners, due dates and status." },
    ],
  }),
  component: TasksPage,
});

const STATUSES = ["todo", "in_progress", "done"] as const;

function TasksPage() {
  const qc = useQueryClient();
  const { data: user } = useUser();
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState("all");
  const [editing, setEditing] = useState<any>(null);
  const [del, setDel] = useState<string | null>(null);

  const peopleQ = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles:assignee_id(full_name, email)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = editing
        ? await supabase.from("tasks").update(payload as never).eq("id", editing.id)
        : await supabase.from("tasks").insert({ ...payload, created_by: user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? tt("Saved") : tt("Task created"));
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status: v.status }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = (tasksQ.data ?? []).filter(
    (t: any) => !t.is_marketing && (assignee === "all" || t.assignee_id === assignee),
  );

  return (
    <div>
      <PageHeader
        title={tt("Tasks")}
        description={tt("Who is doing what, and by when.")}
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>{tt("New task")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? tt("Edit") : tt("New task")}</DialogTitle>
              </DialogHeader>
              <form
                key={editing?.id ?? "new"}
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const a = String(f.get("assignee_id") || "");
                  create.mutate({
                    title: String(f.get("title")),
                    description: String(f.get("description") || "") || null,
                    assignee_id: a || null,
                    due_date: String(f.get("due_date") || "") || null,
                    priority: String(f.get("priority")),
                    ...(editing ? {} : { status: "todo" }),
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="t-title">{tt("Title")}</Label>
                  <Input id="t-title" name="title" required defaultValue={editing?.title ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-desc">{tt("Description")}</Label>
                  <Textarea id="t-desc" name="description" defaultValue={editing?.description ?? ""} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="t-assignee">{tt("Assignee")}</Label>
                    <select
                      id="t-assignee"
                      name="assignee_id"
                      defaultValue={editing?.assignee_id ?? ""}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{tt("Unassigned")}</option>
                      {(peopleQ.data ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-priority">{tt("Priority")}</Label>
                    <select
                      id="t-priority"
                      name="priority"
                      defaultValue={editing?.priority ?? "normal"}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="low">{tt("Low")}</option>
                      <option value="normal">{tt("Normal")}</option>
                      <option value="high">{tt("High")}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-due">{tt("Due date")}</Label>
                  <Input id="t-due" name="due_date" type="date" defaultValue={editing?.due_date ?? ""} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>{tt("Save")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 w-64">
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("Everyone")}</SelectItem>
            {(peopleQ.data ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((sec) => {
          const rows = tasks.filter((t: any) => t.status === sec.key);
          return (
            <Card key={sec.key}>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${sec.dot}`} />
                  <h2 className="font-display text-lg">{tt(sec.labelKey)}</h2>
                  <Badge variant="secondary">{rows.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tt("Task")}</TableHead>
                      <TableHead>{tt("Assignee")}</TableHead>
                      <TableHead>{tt("Due")}</TableHead>
                      <TableHead>{tt("Priority")}</TableHead>
                      <TableHead>{tt("Status")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="font-medium">{t.title}</p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground rtl-content">{t.description}</p>
                          )}
                        </TableCell>
                        <TableCell>{t.profiles?.full_name || t.profiles?.email || tt("Unassigned")}</TableCell>
                        <TableCell>{formatDate(t.due_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PRIORITY_TONE[t.priority] ?? "bg-muted text-muted-foreground"}>
                            {tt(titleCase(t.priority))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={STATUS_TONE[t.status] ?? ""}>
                              {tt(sec.labelKey)}
                            </Badge>
                            <select
                              value={t.status}
                              aria-label={tt("Status")}
                              onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value })}
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {tt(SECTIONS.find((x) => x.key === s)!.labelKey)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {t.status !== "done" && (
                            <Button size="icon" variant="ghost" aria-label={tt("taskMarkDone")} title={tt("taskMarkDone")} onClick={() => setStatus.mutate({ id: t.id, status: "done" })}>
                              <Check className="size-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" aria-label={tt("Edit")} onClick={() => { setEditing(t); setOpen(true); }}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={tt("Delete")} onClick={() => setDel(t.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          {tt("No tasks yet.")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ConfirmDelete open={!!del} onOpenChange={(v) => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />
    </div>
  );
}
