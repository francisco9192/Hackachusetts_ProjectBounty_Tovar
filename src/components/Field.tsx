/**
 * Field primitives: `Input`, `Textarea`, and `Select`.
 *
 * Each renders a visible `<label htmlFor>` tied to the control's `id`, and when
 * an `error` string is present it renders the message, links it to the control
 * via `aria-describedby`, and sets `aria-invalid` (Req 16.3, 16.6 foundation).
 * An optional `hint` is also linked via `aria-describedby`. When no `id` is
 * supplied one is generated with `useId`, so every field is correctly labelled
 * even if the caller forgets to pass an id.
 *
 * All user-facing text (label, hint, error) is rendered through normal JSX so
 * React escapes it; `dangerouslySetInnerHTML` is never used.
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/** Fields common to every control in this module. */
interface FieldCommon {
  /** Visible label text, tied to the control via `htmlFor`/`id`. */
  label: string;
  /** Optional helper text shown under the label, linked via `aria-describedby`. */
  hint?: string;
  /** Validation message; when present, sets `aria-invalid` and links the error. */
  error?: string;
}

/**
 * Build the `aria-describedby` value and the hint/error element ids for a
 * control, given its resolved id and whether a hint/error is present.
 */
function describedBy(
  id: string,
  hasHint: boolean,
  hasError: boolean,
): { hintId: string; errorId: string; describedBy: string | undefined } {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const ids = [hasHint ? hintId : null, hasError ? errorId : null].filter(
    (v): v is string => v !== null,
  );
  return {
    hintId,
    errorId,
    describedBy: ids.length > 0 ? ids.join(' ') : undefined,
  };
}

const CONTROL_CLASSES =
  'mt-1 block w-full rounded-card border border-surface-border bg-surface ' +
  'px-3 py-2 text-ink placeholder:text-ink-muted ' +
  'aria-[invalid=true]:border-danger';

const LABEL_CLASSES = 'block text-sm font-medium text-ink';
const HINT_CLASSES = 'mt-1 text-sm text-ink-muted';
const ERROR_CLASSES = 'mt-1 text-sm text-danger';

/** Shared label + hint + error scaffold rendered around a control. */
function FieldShell({
  id,
  label,
  hint,
  error,
  hintId,
  errorId,
  children,
}: {
  id: string;
  label: string;
  hint: string | undefined;
  error: string | undefined;
  hintId: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
      </label>
      {children}
      {hint !== undefined && hint.length > 0 ? (
        <p id={hintId} className={HINT_CLASSES}>
          {hint}
        </p>
      ) : null}
      {error !== undefined && error.length > 0 ? (
        <p id={errorId} className={ERROR_CLASSES}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type InputProps = FieldCommon &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { id?: string };

export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const hasHint = hint !== undefined && hint.length > 0;
  const hasError = error !== undefined && error.length > 0;
  const { hintId, errorId, describedBy: desc } = describedBy(resolvedId, hasHint, hasError);

  return (
    <FieldShell
      id={resolvedId}
      label={label}
      hint={hint}
      error={error}
      hintId={hintId}
      errorId={errorId}
    >
      <input
        id={resolvedId}
        className={[CONTROL_CLASSES, className].filter(Boolean).join(' ')}
        aria-invalid={hasError || undefined}
        aria-describedby={desc}
        {...rest}
      />
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

export type TextareaProps = FieldCommon &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { id?: string };

export function Textarea({ label, hint, error, id, className, ...rest }: TextareaProps) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const hasHint = hint !== undefined && hint.length > 0;
  const hasError = error !== undefined && error.length > 0;
  const { hintId, errorId, describedBy: desc } = describedBy(resolvedId, hasHint, hasError);

  return (
    <FieldShell
      id={resolvedId}
      label={label}
      hint={hint}
      error={error}
      hintId={hintId}
      errorId={errorId}
    >
      <textarea
        id={resolvedId}
        className={[CONTROL_CLASSES, className].filter(Boolean).join(' ')}
        aria-invalid={hasError || undefined}
        aria-describedby={desc}
        {...rest}
      />
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export type SelectProps = FieldCommon &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
    id?: string;
    children: ReactNode;
  };

export function Select({ label, hint, error, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;
  const hasHint = hint !== undefined && hint.length > 0;
  const hasError = error !== undefined && error.length > 0;
  const { hintId, errorId, describedBy: desc } = describedBy(resolvedId, hasHint, hasError);

  return (
    <FieldShell
      id={resolvedId}
      label={label}
      hint={hint}
      error={error}
      hintId={hintId}
      errorId={errorId}
    >
      <select
        id={resolvedId}
        className={[CONTROL_CLASSES, className].filter(Boolean).join(' ')}
        aria-invalid={hasError || undefined}
        aria-describedby={desc}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
