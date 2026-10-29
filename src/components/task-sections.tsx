import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, titleCase } from "@/lib/format";
import { tt } from "@/lib/i18n";
import { Check, Pencil, Trash2 } from "lucide-react";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;

const SECTIONS = [
  { key: "todo", labelKey: "taskPending", dot: "bg-muted-foreground" },
  { key: "in_progress", labelKey: "taskInProgress", dot: "bg-info" },
  { key: "done", labelKey: "taskCompleted", dot: "bg-success" },
] as const;

const PRIORITY_TONE: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/15 text-destructive",
  normal: "border-warning/40 bg-warning/20 text-warning-foreground",
  low: "bg-muted text-muted-foreground",
};

const STATUS_TONE: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "border-info/40 bg-info/20 text-foreground",
  done: "border-success/40 bg-success/20 text-foreground",
};

/** Sectioned task table (Pending / In progress / Completed) shared by Tasks and Marketing. */
export function TaskSections({
  tasks,
  onEdit,
  onDelete,
  onSetStatus,
}: {
  tasks: any[];
  onEdit: (task: any) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: string) => void;
}) {
  return (
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
                            onChange={(e) => onSetStatus(t.id, e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {tt(SECTIONS.find((x) => x.key === s)!.labelKey)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {t.status !== "done" && (
                          <Button size="icon" variant="ghost" aria-label={tt("taskMarkDone")} title={tt("taskMarkDone")} onClick={() => onSetStatus(t.id, "done")}>
                            <Check className="size-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label={tt("Edit")} onClick={() => onEdit(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={tt("Delete")} onClick={() => onDelete(t.id)}>
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
  );
}
