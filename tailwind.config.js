/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#166534',
          600: '#15803d',
          700: '#14532d',
          800: '#052e16',
          900: '#022c22',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
      },
      fontFamily: {
        arabic: ['"Noto Naskh Arabic"', 'serif'],
      },
    },
  },
  plugins: [],
}
