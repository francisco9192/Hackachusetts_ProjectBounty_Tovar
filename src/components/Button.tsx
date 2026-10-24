/**
 * Button: the single styled button primitive for Bounty.
 *
 * Variants map to the shared theme tokens (`brand`, `surface`, `danger`). A
 * `loading` button is disabled and shows a visible busy label so one click can
 * create at most one record (Req 2.10, 17.3). The native `type` and `onClick`
 * plus every remaining button prop are forwarded, so callers keep full control.
 *
 * Accessibility: the focus ring comes from the `:focus-visible` baseline in
 * `index.css`. An icon-only button (no text children) MUST supply an
 * `aria-label`; the prop types below require either visible `children` or an
 * `aria-label` so the button always has an accessible name.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Visual intent of the button. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/**
 * Props shared by both shapes. `loading` disables the button and swaps the
 * label for a busy indicator. `type` defaults to `'button'` so a Button inside
 * a form never submits by accident.
 */
interface ButtonBaseProps extends NativeButtonProps {
  variant?: ButtonVariant;
  loading?: boolean;
}

/**
 * Either the button has visible text `children`, or it is icon-only and MUST
 * carry an `aria-label`. This union makes an unnamed icon-only button a type
 * error at the call site (accessible-name guarantee, Req 16.x).
 */
export type ButtonProps =
  | (ButtonBaseProps & { children: ReactNode; 'aria-label'?: string })
  | (ButtonBaseProps & { children?: undefined; 'aria-label': string });

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-surface hover:bg-brand-700 border border-transparent',
  secondary:
    'bg-surface text-ink hover:bg-surface-alt border border-surface-border',
  danger: 'bg-danger text-surface hover:opacity-90 border border-transparent',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-card px-4 py-2 ' +
  'text-sm font-semibold transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          <span>Working…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** Small decorative spinner; the visible "Working…" text carries the meaning. */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
