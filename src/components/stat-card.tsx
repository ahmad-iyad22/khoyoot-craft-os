import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  previous,
  invertColor = false,
  hint,
}: {
  label: string;
  value: string;
  previous?: number | null;
  invertColor?: boolean;
  hint?: string;
}) {
  const { t } = useI18n();
  const hasDelta = previous !== undefined && previous !== null && Number.isFinite(previous);
  const up = (previous ?? 0) > 0.05;
  const down = (previous ?? 0) < -0.05;
  const good = invertColor ? down : up;

  return (
    <div className="card-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl text-foreground">{value}</p>
      {hasDelta ? (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            !up && !down ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
          )}
        >
          {up ? <ArrowUpRight className="size-3" /> : down ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
          {Math.abs(previous ?? 0).toFixed(1)}% {t("comparedLastMonth")}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
