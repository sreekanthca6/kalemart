/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4F46E5', light: '#818CF8', dark: '#3730A3' },
      },
    },
  },
  plugins: [],
};
