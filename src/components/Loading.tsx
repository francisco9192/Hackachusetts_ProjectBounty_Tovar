/**
 * Loading: a busy indicator with a VISIBLE text label (Req 17.3). The spinner
 * is decorative (hidden from assistive tech); the "Loading" text carries the
 * meaning, and the region is announced politely via `role="status"`.
 */
export interface LoadingProps {
  /** Overridable visible label; defaults to "Loading". */
  label?: string;
  className?: string;
}

export function Loading({ label = 'Loading', className }: LoadingProps) {
  const classes = ['inline-flex items-center gap-2 text-ink-muted', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div role="status" aria-live="polite" className={classes}>
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-r-transparent"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
