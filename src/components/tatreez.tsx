/** Subtle geometric tatreez-inspired SVG motifs used as dividers and empty states. */
export function TatreezDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`h-3 w-full text-primary/35 ${className}`}
    >
      <g fill="currentColor">
        {Array.from({ length: 20 }, (_, i) => (
          <g key={i} transform={`translate(${i * 12} 0)`}>
            <path d="M6 0 L12 6 L6 12 L0 6 Z" opacity="0.55" />
            <rect x="5" y="5" width="2" height="2" opacity="0.9" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function TatreezEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-14 text-primary/30">
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M32 4 L60 32 L32 60 L4 32 Z" />
          <path d="M32 16 L48 32 L32 48 L16 32 Z" />
          <path d="M32 26 L38 32 L32 38 L26 32 Z" fill="currentColor" stroke="none" />
        </g>
      </svg>
      <p className="font-display text-lg text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
