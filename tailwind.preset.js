/** Shared design tokens for every ThreadShelf surface. Colours are HSL triplets in CSS variables. */
const c = (v) => `hsl(var(--ts-${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '.dark'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        subtle: c('subtle'),
        elevated: c('elevated'),
        fg: c('fg'),
        muted: c('muted'),
        faint: c('faint'),
        line: c('line'),
        accent: { DEFAULT: c('accent'), fg: c('accent-fg'), soft: c('accent-soft') },
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Inter"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        serif: ['ui-serif', '"New York"', '"Iowan Old Style"', 'Charter', 'Georgia', 'serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        pop: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -6px rgb(0 0 0 / 0.18)',
        float:
          '0 0 0 1px rgb(0 0 0 / 0.04), 0 2px 6px rgb(0 0 0 / 0.06), 0 22px 48px -12px rgb(0 0 0 / 0.28)',
      },
      keyframes: {
        'ts-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'ts-fade': { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'ts-in': 'ts-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'ts-fade': 'ts-fade 160ms ease-out',
      },
    },
  },
};
