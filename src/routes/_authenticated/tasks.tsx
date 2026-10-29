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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDelete } from "@/components/confirm-delete";
import { TaskSections } from "@/components/task-sections";

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

      <TaskSections
        tasks={tasks}
        onEdit={(task) => { setEditing(task); setOpen(true); }}
        onDelete={(id) => setDel(id)}
        onSetStatus={(id, status) => setStatus.mutate({ id, status })}
      />
      <ConfirmDelete open={!!del} onOpenChange={(v) => !v && setDel(null)} onConfirm={() => del && remove.mutate(del)} />
    </div>
  );
}
