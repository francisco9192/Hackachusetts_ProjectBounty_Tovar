/**
 * ErrorState: a plain-language failure message plus a "Retry" button
 * (Req 17.4 / 17.5 foundation). The message should name the action that failed
 * and must never contain raw database text (callers map codes through
 * `src/lib/errors.ts` first). The region is announced via `role="alert"`.
 */
import { Button } from './Button';

export interface ErrorStateProps {
  /** Plain-language message, e.g. "We couldn't load this task." */
  message: string;
  /** Called when the user presses Retry. Omit to hide the button. */
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-card border border-surface-border bg-surface p-4 text-ink"
    >
      <p className="text-sm">{message}</p>
      {onRetry !== undefined ? (
        <div className="mt-3">
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
