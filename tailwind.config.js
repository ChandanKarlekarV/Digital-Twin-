/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        reliance: {
          navy: '#002B49',
          deepnavy: '#001726',
          blue: '#004B87',
          accent: '#0066B3',
          red: '#ED1B24',
          cyan: '#00F0FF',
          dark: '#0A0E14',
          surface: 'rgba(0, 43, 73, 0.65)',
          surfaceHover: 'rgba(0, 75, 135, 0.75)',
          border: 'rgba(0, 240, 255, 0.2)',
          borderGlow: 'rgba(0, 240, 255, 0.5)',
          textMain: '#F4F6F9',
          textMuted: '#8EA8BF',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(0, 240, 255, 0.35)',
        'cyan-glow-lg': '0 0 25px rgba(0, 240, 255, 0.5)',
        'red-glow': '0 0 20px rgba(237, 27, 36, 0.6)',
        'dock': '0 8px 32px 0 rgba(0, 15, 30, 0.7)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'sweep 4s linear infinite',
        'telemetry-flow': 'flow 2s linear infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        flow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
