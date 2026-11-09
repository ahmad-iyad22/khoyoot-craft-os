import { cn } from "@/lib/utils";

/** Cross-stitch X mark built from small squares, in the primary colour. */
export function LogoMark({ className }: { className?: string | undefined }) {
  const cells: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    cells.push([i, i]);
    if (i !== 3) cells.push([6 - i, i]);
  }
  return (
    <svg viewBox="0 0 7 7" className={cn("size-7 shrink-0 text-sidebar-primary", className)} aria-hidden="true">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} fill="currentColor" />
      ))}
    </svg>
  );
}

export function Logo({ className, markClassName, label }: { className?: string; markClassName?: string | undefined; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display leading-none", className)}>
      <LogoMark className={markClassName} />
      <span>{label}</span>
    </span>
  );
}
