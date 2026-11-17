/** @type {import('tailwindcss').Config} */

// All colours come from the CSS tokens in src/styles/tokens.css
const tok = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ramp = (name) => Object.fromEntries(STEPS.map((s) => [s, tok(`${name}-${s}`)]));

const accent = ramp('accent');
const success = ramp('success');
const warning = ramp('warning');
const danger = ramp('danger');

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: tok('bg'),
        surface: { DEFAULT: tok('surface'), 2: tok('surface-2'), 3: tok('surface-3') },
        line: { DEFAULT: tok('border'), strong: tok('border-strong') },
        ink: { DEFAULT: tok('text'), muted: tok('text-muted'), faint: tok('text-faint') },
        accent,
        success,
        warning,
        danger,

        // Tailwind families folded onto the four semantic tones
        cyan: accent,
        sky: accent,
        blue: accent,
        indigo: accent,
        violet: accent,
        purple: accent,
        fuchsia: accent,
        emerald: success,
        green: success,
        teal: success,
        lime: success,
        amber: warning,
        yellow: warning,
        orange: warning,
        red: danger,
        rose: danger,
        pink: danger,

        // Legacy names used across the HUD, now token-backed
        reliance: {
          navy: tok('surface-2'),
          deepnavy: tok('surface'),
          blue: tok('surface-3'),
          accent: tok('accent-500'),
          red: tok('danger-400'),
          cyan: tok('accent-400'),
          dark: tok('bg'),
          textMain: tok('text'),
          textMuted: tok('text-muted'),
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-md)',
        xl: 'var(--radius-md)',
        '2xl': 'var(--radius-lg)',
        '3xl': 'var(--radius-lg)',
      },
      // Neon glows replaced by a quiet outline; elevation from one panel shadow
      boxShadow: {
        'cyan-glow': '0 0 0 1px rgb(var(--accent-400) / 0.35)',
        'cyan-glow-lg': '0 0 0 1px rgb(var(--accent-400) / 0.5)',
        'emerald-glow': '0 0 0 1px rgb(var(--success-400) / 0.35)',
        'amber-glow': '0 0 0 1px rgb(var(--warning-400) / 0.35)',
        'red-glow': '0 0 0 1px rgb(var(--danger-400) / 0.5)',
        'rose-glow': '0 0 0 1px rgb(var(--danger-400) / 0.5)',
        dock: 'var(--shadow-panel)',
      },
      width: {
        76: '19rem',
        84: '21rem',
        88: '22rem',
        side: 'var(--side-panel-w)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 6s linear infinite',
      },
    },
  },
  plugins: [],
};
