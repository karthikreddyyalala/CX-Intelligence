/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Geist', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Single "signal" accent — warm amber-gold. No AI-purple.
        signal: {
          50: '#fdf6e9', 100: '#f9e8c4', 200: '#f2d190',
          300: '#e9b757', 400: '#e0a03a', 500: '#c9862a',
          600: '#a76a20', 700: '#7f4f1c', 800: '#5c3a19', 900: '#3d2711',
        },
        // Warm near-black obsidian base (never pure #000)
        ink: {
          950: '#0a0a0c', 900: '#101014', 850: '#15151b',
          800: '#1c1c24', 700: '#26262f', 600: '#33333f',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'sweep': 'sweep 3.5s linear infinite',
      },
    },
  },
  plugins: [],
};
