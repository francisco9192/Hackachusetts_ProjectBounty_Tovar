/**
 * Badge: a small pill showing a status or type as a TEXT label plus an optional
 * decorative icon. The text label is ALWAYS visible and color is only a
 * secondary signal, never the only one (Req 16.8). Values are humanized from
 * `snake_case` via `humanize` (Req 16.9).
 *
 * Helper components (`TaskStatusBadge`, `RewardTypeBadge`, `RewardStatusBadge`,
 * `ApplicationStatusBadge`) map each domain enum to a tone and render a Badge,
 * so callers never pass raw `snake_case` to the UI.
 */
import type { ReactNode } from 'react';
import { humanize } from '../domain/labels';
import type {
  ApplicationStatus,
  RewardStatus,
  RewardType,
  TaskStatus,
} from '../domain/constants';

/** Color tone of a badge. Color is decorative; the text label carries meaning. */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  /** Text shown inside the badge. Always rendered. */
  label: string;
  /** Optional decorative icon (emoji/svg). Hidden from assistive tech. */
  icon?: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-alt text-ink border-surface-border',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-surface-alt text-success border-surface-border',
  warning: 'bg-surface-alt text-warning border-surface-border',
  danger: 'bg-surface-alt text-danger border-surface-border',
};

export function Badge({ label, icon, tone = 'neutral', className }: BadgeProps) {
  const classes = [
    'inline-flex items-center gap-1 rounded-card border px-2 py-0.5 text-xs font-medium',
    TONE_CLASSES[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes}>
      {icon !== undefined ? (
        <span aria-hidden="true" className="leading-none">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Domain-specific badge helpers
// ---------------------------------------------------------------------------

const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  open: 'brand',
  in_progress: 'warning',
  submitted: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

/** Badge for a Task_Status, humanized with a tone (text always visible). */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge label={humanize(status)} tone={TASK_STATUS_TONE[status]} />;
}

const REWARD_TYPE_TONE: Record<RewardType, BadgeTone> = {
  monetary: 'success',
  nonmonetary: 'brand',
  volunteer: 'neutral',
};

const REWARD_TYPE_ICON: Record<RewardType, string> = {
  monetary: '💵',
  nonmonetary: '🎁',
  volunteer: '🤝',
};

/** Badge for a Reward_Type, humanized with a decorative icon and tone. */
export function RewardTypeBadge({ type }: { type: RewardType }) {
  return (
    <Badge
      label={humanize(type)}
      icon={REWARD_TYPE_ICON[type]}
      tone={REWARD_TYPE_TONE[type]}
    />
  );
}

const REWARD_STATUS_TONE: Record<RewardStatus, BadgeTone> = {
  not_applicable: 'neutral',
  pending: 'warning',
  simulated_paid: 'success',
  delivered: 'success',
  received: 'success',
};

/** Badge for a Reward_Status, humanized with a tone (text always visible). */
export function RewardStatusBadge({ status }: { status: RewardStatus }) {
  return <Badge label={humanize(status)} tone={REWARD_STATUS_TONE[status]} />;
}

const APPLICATION_STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

/** Badge for an Application_Status, humanized with a tone (text always visible). */
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge label={humanize(status)} tone={APPLICATION_STATUS_TONE[status]} />;
}
