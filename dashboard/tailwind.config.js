/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0f1e',
          card:    '#0d1526',
          border:  '#1a2540',
        },
        vitals: {
          healthy:  '#00ff88',
          warning:  '#f59e0b',
          critical: '#ef4444',
          info:     '#38bdf8',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        pulse_slow:   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow:         'glow 2s ease-in-out infinite alternate',
        scroll_up:    'scrollUp 0.3s ease-out',
        heartbeat:    'heartbeat 1.5s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 8px 2px rgba(0,255,136,0.2)' },
          to:   { boxShadow: '0 0 20px 6px rgba(0,255,136,0.5)' },
        },
        scrollUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%':      { transform: 'scale(1.15)' },
          '28%':      { transform: 'scale(1)' },
          '42%':      { transform: 'scale(1.1)' },
          '70%':      { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
