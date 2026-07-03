/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae7ff',
          500: '#4f6bed',
          600: '#3b56d1',
          700: '#2f43a8',
          900: '#1c2966'
        }
      }
    }
  },
  plugins: []
};
