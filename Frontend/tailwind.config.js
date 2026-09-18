/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#10B981',
          greenDark: '#059669',
          greenLight: '#E8F8F0',
          purple: '#6366F1',
          purpleDark: '#4F46E5',
          purpleLight: '#EEF2FF',
          dark: '#0F172A',
          muted: '#64748B',
          surface: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E8EFF5'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px -2px rgba(15, 23, 42, 0.04), 0 4px 20px -4px rgba(15, 23, 42, 0.03)',
        cardHover: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
      }
    },
  },
  plugins: [],
}
