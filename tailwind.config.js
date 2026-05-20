/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '480px',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-down': {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'scale-x-in': {
          '0%':   { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'stagger-fade': {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'soft-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '40%':      { transform: 'translateY(-8px)' },
          '60%':      { transform: 'translateY(-4px)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(1)',    opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        'candle-grow': {
          '0%':   { transform: 'scaleY(0)' },
          '100%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-up':      'fade-up 0.4s cubic-bezier(.22,1,.36,1) both',
        'fade-in':      'fade-in 0.3s ease both',
        'slide-down':   'slide-down 0.3s cubic-bezier(.22,1,.36,1) both',
        'slide-up':     'slide-up 0.45s cubic-bezier(.22,1,.36,1) both',
        'scale-in':     'scale-in 0.35s cubic-bezier(.22,1,.36,1) both',
        'scale-x-in':   'scale-x-in 0.25s cubic-bezier(.22,1,.36,1) both',
        'stagger-fade': 'stagger-fade 0.4s cubic-bezier(.22,1,.36,1) both',
        'soft-bounce':  'soft-bounce 0.6s ease both',
        'pulse-ring':   'pulse-ring 1.4s ease-out infinite',
        'candle-grow':  'candle-grow 0.6s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
}
