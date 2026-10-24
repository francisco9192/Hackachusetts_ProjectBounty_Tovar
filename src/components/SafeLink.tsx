/**
 * SafeLink: render a clickable anchor ONLY when the given `url` is a safe
 * http(s) link per `isHttpUrl`; otherwise render the raw string as plain text
 * (Req 10.4). This blocks `javascript:`, `mailto:`, `data:` and malformed URLs
 * from ever becoming an anchor.
 *
 * External links open in a new tab with `rel="noopener noreferrer"`. The URL
 * text is rendered through normal JSX so React escapes it either way.
 */
import type { ReactNode } from 'react';
import { isHttpUrl } from '../domain/validation';

export interface SafeLinkProps {
  /** The candidate URL (typically user-provided). */
  url: string;
  /** Optional link text; defaults to showing the URL itself. */
  children?: ReactNode;
  className?: string;
}

export function SafeLink({ url, children, className }: SafeLinkProps) {
  if (!isHttpUrl(url)) {
    // Not a safe web link: show the raw value as plain, non-clickable text.
    return <span className={className}>{children ?? url}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={['text-brand-700 underline hover:text-brand-600', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children ?? url}
    </a>
  );
}
