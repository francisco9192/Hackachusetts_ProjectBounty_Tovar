/**
 * RewardDisplay: show a Task's Reward as icon + text label + detail (Req 3.9).
 *
 * Delegates all formatting to the pure `formatReward` from the domain layer, so
 * the exact label/icon/detail strings stay in one place. The text label is
 * always present (the icon is decorative and hidden from assistive tech), and
 * every piece of text — including user-provided nonmonetary descriptions — is
 * rendered through normal JSX so React escapes it.
 */
import { formatReward, type Reward } from '../domain/reward';

export interface RewardDisplayProps {
  reward: Reward;
  className?: string;
}

export function RewardDisplay({ reward, className }: RewardDisplayProps) {
  const { label, icon, detail } = formatReward(reward);
  const classes = ['inline-flex items-center gap-2 text-ink', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes}>
      <span aria-hidden="true">{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="text-ink-muted">·</span>
      <span>{detail}</span>
    </span>
  );
}
