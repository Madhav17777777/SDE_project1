/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#030712', // Extremely dark blue/gray
          900: '#0f172a', // Dark blue/gray (Slate-900)
          800: '#1e293b', // Slate-800
          700: '#334155', // Slate-700
          600: '#475569', // Slate-600
        },
        brand: {
          500: '#6366f1', // Indigo-500
          600: '#4f46e5', // Indigo-600
          700: '#4338ca', // Indigo-700
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
