/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f7f7f7',
        accent: '#b38f5b', // Gold - Primary accent color
        accentSecondary: '#007AFF', // System Blue - Selections (content-first)
        muted: '#e5e5e5',
      },
      boxShadow: {
        card: '0 10px 30px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

