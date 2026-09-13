import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const TONE: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  in_development: "bg-warning/20 text-warning-foreground border-warning/40",
  preparing: "bg-warning/20 text-warning-foreground border-warning/40",
  ready: "bg-secondary text-secondary-foreground",
  future_product: "bg-muted text-muted-foreground",
  active: "bg-success/20 text-foreground border-success/40",
  out_of_stock: "bg-destructive/15 text-destructive border-destructive/40",
  discontinued: "bg-muted text-muted-foreground line-through",
  sent_from_palestine: "bg-secondary text-secondary-foreground",
  in_transit: "bg-warning/20 text-warning-foreground border-warning/40",
  customs: "bg-warning/25 text-warning-foreground border-warning/50",
  arrived_in_malaysia: "bg-accent/20 text-foreground border-accent/40",
  added_to_inventory: "bg-success/20 text-foreground border-success/40",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { ts } = useI18n();
  return (
    <Badge variant="outline" className={cn("border font-medium", TONE[status] ?? "", className)}>
      {ts(status)}
    </Badge>
  );
}
