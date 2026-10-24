/**
 * ReportButton: a minimal presentational trigger for the report flow. The full
 * report dialog + submission logic is task 23; this stub only renders a button
 * that calls `onClick`, so pages can place it now without wiring any behavior.
 *
 * Intentionally NOT wired to the dialog or `validateReport`/`api` here.
 */
import { Button } from './Button';

export interface ReportButtonProps {
  /** Opens the report dialog (wired in task 23). */
  onClick: () => void;
  className?: string;
}

export function ReportButton({ onClick, className }: ReportButtonProps) {
  return (
    <Button variant="secondary" onClick={onClick} className={className}>
      Report
    </Button>
  );
}
