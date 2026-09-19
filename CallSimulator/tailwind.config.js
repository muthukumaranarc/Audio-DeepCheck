/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        simulator: {
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          accent: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b'
        }
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.08)' }
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1.0)' }
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'wave-bar': 'wave 1.2s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
