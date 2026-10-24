/**
 * YouthSafetyNotice: the shared plain-language safety notice shown to and about
 * Youth_Members (Req 1.3, 13.4). It advises keeping personal contact details
 * out of Bounty and involving a parent or guardian for any in-person reward
 * pickup. Presentational only; callers decide when to show it.
 *
 * Rendered in a `role="note"` region so assistive tech announces it as an aside.
 * All text is static plain text (no user input, no `dangerouslySetInnerHTML`).
 */
export interface YouthSafetyNoticeProps {
  className?: string;
}

export function YouthSafetyNotice({ className }: YouthSafetyNoticeProps) {
  const classes = [
    'rounded-card border border-surface-border bg-surface-alt p-3 text-sm text-ink',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div role="note" aria-label="Youth safety notice" className={classes}>
      <p className="font-semibold">Staying safe</p>
      <p className="mt-1 text-ink-muted">
        Keep personal contact information — your phone number, email address,
        home address, and social media handles — out of Bounty, and keep all
        contact inside the in-app message thread. If a reward involves an
        in-person pickup, involve a parent or guardian.
      </p>
    </div>
  );
}
