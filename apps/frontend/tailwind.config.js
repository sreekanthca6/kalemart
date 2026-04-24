/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0c1510',
        surface:  '#111e16',
        's2':     '#172318',
        's3':     '#1e2e22',
        brand:    '#7ec87a',
        amber:    '#d4903d',
        critical: '#d95b47',
        info:     '#5b9fd4',
        cream:    '#e8dfc8',
        sage:     '#7a9482',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-body)',    'sans-serif'],
        mono:    ['var(--font-mono)',    'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(126,200,122,0.09)',
      },
    },
  },
  plugins: [],
};
