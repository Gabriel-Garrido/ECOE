/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Universidad Mayor – Brand palette
        brand: {
          yellow: '#FEDA3F',
          'yellow-alt': '#FECE40',
          'yellow-light': '#FFF8E1',
          teal: '#12636B',
          'teal-dark': '#0E4F56',
          'teal-light': '#E8F4F5',
          red: '#A4222B',
          'red-dark': '#8B1D24',
          'red-light': '#FDF2F2',
        },
        neutral: {
          dark: '#343742',
          'gray-dark': '#3C3C3B',
          gray: '#888992',
          'gray-soft': '#B7BBB4',
          'gray-light': '#CCCCCC',
          'gray-pale': '#E3E3E3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(1rem)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
