/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        ring: 'rgb(var(--ring-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        subtle: 'rgb(var(--subtle-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover-rgb) / <alpha-value>)',
          soft: 'rgb(var(--brand-rgb) / 0.12)',
          foreground: '#ffffff'
        },
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        // Keep existing utility consumers on the same neutral/indigo palette.
        slate: {
          50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8',
          400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46',
          800: '#26262c', 900: '#15151a', 950: '#0a0a0b'
        },
        brand: {
          50: '#f3f1ff', 100: '#e7e3fb', 200: '#d5cef7', 300: '#b3abf0',
          400: '#968ae8', 500: '#7b6cdd', 600: '#6256ce', 700: '#544ab0',
          800: '#463e90', 900: '#393373', 950: '#211d46'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        popover: '0 16px 48px rgb(0 0 0 / 0.28)',
        glow: '0 0 0 1px rgb(var(--brand-rgb) / 0.35), 0 8px 28px rgb(var(--brand-rgb) / 0.28)'
      }
    }
  },
  plugins: []
};
