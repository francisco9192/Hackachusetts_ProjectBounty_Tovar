/**
 * DemoNotice: a small inline notice stating that payment is simulated
 * (Req 9.5). Shown near any simulated-payment action so no one mistakes the
 * demo for a real transaction. Static plain text.
 */
export interface DemoNoticeProps {
  className?: string;
}

export function DemoNotice({ className }: DemoNoticeProps) {
  const classes = [
    'inline-flex items-center gap-1 rounded-card border border-surface-border ' +
      'bg-surface-alt px-2 py-0.5 text-xs font-medium text-warning',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes}>
      <span aria-hidden="true">⚠️</span>
      <span>Demo only - no real money is moved</span>
    </span>
  );
}
