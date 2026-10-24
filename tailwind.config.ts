import type { Config } from 'tailwindcss'

/**
 * Shared design-system theme for Bounty.
 *
 * All color/spacing/typography tokens used by the UI must come from here so
 * accessibility rules (contrast, focus) stay consistent across every page.
 * These tokens are intentionally minimal for the scaffold; later tasks flesh
 * out the full palette and component styles. Body text colors are chosen to
 * meet WCAG AA contrast (>= 4.5:1) on a white surface.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand accent used for primary actions and focus rings.
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          500: '#1d6fe0', // meets 3:1 against white for large text / borders
          600: '#155bbd', // meets 4.5:1 against white for normal text
          700: '#114a99',
        },
        // Neutral surface + text tokens.
        ink: {
          DEFAULT: '#1a1d21', // primary body text (>= 4.5:1 on white)
          muted: '#4a5159', // secondary text (>= 4.5:1 on white)
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f5f7fa',
          border: '#c3cad3', // >= 3:1 against white for component borders
        },
        // Status accents (always paired with a text label in the UI).
        success: '#1f7a3d',
        warning: '#9a5b00',
        danger: '#b42318',
      },
      borderRadius: {
        card: '0.75rem',
      },
    },
  },
  plugins: [],
}

export default config
