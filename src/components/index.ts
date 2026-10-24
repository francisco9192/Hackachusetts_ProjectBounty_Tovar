/**
 * Barrel export for the shared presentational component library, so pages can
 * import everything from `'../components'`.
 *
 * All components here are presentational: no data fetching, no Supabase, no
 * import of `src/lib/auth` (Layout takes its auth-dependent bits as props). All
 * user text is rendered through normal JSX; `dangerouslySetInnerHTML` is never
 * used anywhere in this folder.
 */
export { Layout } from './Layout';
export type { LayoutProps } from './Layout';

export { AppLayout } from './AppLayout';
export type { AppLayoutProps } from './AppLayout';

export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';

export { Input, Textarea, Select } from './Field';
export type { InputProps, TextareaProps, SelectProps } from './Field';

export { Card } from './Card';
export type { CardProps } from './Card';

export {
  Badge,
  TaskStatusBadge,
  RewardTypeBadge,
  RewardStatusBadge,
  ApplicationStatusBadge,
} from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { RewardDisplay } from './RewardDisplay';
export type { RewardDisplayProps } from './RewardDisplay';

export { Toast } from './Toast';
export type { ToastProps, ToastVariant } from './Toast';

export { Loading } from './Loading';
export type { LoadingProps } from './Loading';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';

export { SafeLink } from './SafeLink';
export type { SafeLinkProps } from './SafeLink';

export { YouthSafetyNotice } from './YouthSafetyNotice';
export type { YouthSafetyNoticeProps } from './YouthSafetyNotice';

export { DemoNotice } from './DemoNotice';
export type { DemoNoticeProps } from './DemoNotice';

export { ReportButton } from './ReportButton';
export type { ReportButtonProps } from './ReportButton';
