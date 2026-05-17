/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f8fafc',
          900: '#07090f',
          800: '#0d1117',
          700: '#111827',
          600: '#1a2235',
          500: '#243044',
        },
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          glow: 'rgba(99,102,241,0.35)',
        },
        led: {
          on: '#f59e0b',
          onGlow: 'rgba(245,158,11,0.5)',
          off: '#1e293b',
          red: '#ef4444',
          redGlow: 'rgba(239,68,68,0.5)',
          cyan: '#06b6d4',
          cyanGlow: 'rgba(6,182,212,0.5)',
          low: '#f97316',
        },
      },
      animation: {
        'led-pulse': 'led-pulse 1.4s ease-in-out infinite',
        'led-blink': 'led-blink 0.4s ease-in-out 6',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-ring': 'glow-ring 2s ease-in-out infinite',
      },
      keyframes: {
        'led-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 8px 2px rgba(245,158,11,0.4), 0 0 20px 4px rgba(245,158,11,0.2)',
          },
          '50%': {
            boxShadow: '0 0 16px 4px rgba(245,158,11,0.7), 0 0 40px 8px rgba(245,158,11,0.35)',
          },
        },
        'led-blink': {
          '0%, 100%': { backgroundColor: 'rgba(239,68,68,0.15)', boxShadow: 'none' },
          '50%': {
            backgroundColor: 'rgba(239,68,68,0.6)',
            boxShadow: '0 0 20px 4px rgba(239,68,68,0.5)',
          },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-ring': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 0 3px rgba(99,102,241,0.6), 0 0 20px rgba(99,102,241,0.2)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
