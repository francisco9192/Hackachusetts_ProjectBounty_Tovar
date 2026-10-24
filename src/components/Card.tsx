/**
 * Card: a simple surface container used for task cards in browse and dashboard.
 *
 * Purely presentational: a rounded, bordered surface using the shared theme
 * tokens (`rounded-card`, `surface-border`). Forwards remaining `<div>` props
 * and an optional `as` is intentionally omitted to keep it minimal; callers
 * nest their own headings/content.
 */
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  const classes = [
    'rounded-card border border-brand-100 bg-surface-tint p-4 shadow-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
