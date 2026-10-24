/**
 * Display helpers that turn `snake_case` database enum values into plain,
 * human-readable words for the UI (Req 16.9).
 *
 * This module is PURE: no network, no storage, no `Date.now`.
 */

/**
 * Convert a `snake_case` enum value to human-readable words with only the first
 * word capitalized and the rest lowercased.
 *
 * Examples:
 * - `in_progress`    -> "In progress"
 * - `graphic_design` -> "Graphic design"
 * - `simulated_paid` -> "Simulated paid"
 * - `not_applicable` -> "Not applicable"
 * - `open`           -> "Open"
 * - `13-17`          -> "13-17"  (no underscores; returned unchanged)
 *
 * Underscores become spaces. The first visible character is uppercased and
 * every following character is lowercased, so the result reads as a single
 * sentence-cased phrase. Surrounding whitespace is trimmed. An empty or
 * whitespace-only input returns an empty string.
 */
export function humanize(value: string): string {
  const words = value.trim().replace(/_/g, ' ');
  if (words.length === 0) return '';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}
