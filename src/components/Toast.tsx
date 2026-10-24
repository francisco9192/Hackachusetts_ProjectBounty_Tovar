/**
 * Toast: a dismissible notification announced to assistive tech via
 * `role="status"` + `aria-live="polite"` (Req 17.6 foundation). Presentational
 * only — a full toast queue/provider is a later concern; this renders one
 * message with a variant and a dismiss button.
 *
 * Each variant pairs a color with a visible text prefix so color is never the
 * only signal. The message is rendered through normal JSX (React escapes it).
 */
import { Button } from './Button';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-surface-border bg-surface text-success',
  error: 'border-surface-border bg-surface text-danger',
  info: 'border-surface-border bg-surface text-ink',
};

/** Visible text prefix so the meaning survives without color. */
const VARIANT_PREFIX: Record<ToastVariant, string> = {
  success: 'Success',
  error: 'Error',
  info: 'Notice',
};

export function Toast({ message, variant = 'info', onDismiss }: ToastProps) {
  const classes = [
    'flex items-start justify-between gap-3 rounded-card border p-3 shadow-sm',
    VARIANT_CLASSES[variant],
  ].join(' ');
  return (
    <div role="status" aria-live="polite" className={classes}>
      <p className="text-sm">
        <span className="font-semibold">{VARIANT_PREFIX[variant]}:</span>{' '}
        <span className="text-ink">{message}</span>
      </p>
      <Button
        variant="secondary"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="px-2 py-0.5 text-xs"
      >
        Dismiss
      </Button>
    </div>
  );
}
