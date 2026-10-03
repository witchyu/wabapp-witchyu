/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0D0A14',
        surface: '#181222',
        raised: '#221A31',
        line: '#2E2540',
        gold: { DEFAULT: '#D4AE5C', soft: '#E8CC8C', deep: '#A98534' },
        ink: '#F4EFE7',
        mute: '#9C92AB',
        ok: '#5FBF8F',
        warn: '#E8B04A',
        bad: '#E5736F',
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif Thai"', 'Georgia', 'serif'],
      },
      keyframes: {
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        toast: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1)',
        fade: 'fade .2s ease-out',
        toast: 'toast .22s ease-out',
        pop: 'pop .45s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
}
