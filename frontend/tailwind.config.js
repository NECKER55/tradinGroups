/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#050506',
        ink: '#101418',
        canvas: '#edf2f7',
        signal: '#f6ad55',
        ocean: '#4fd1c5',
        gain: '#34d399',
        loss: '#fb7185',
        alert: '#f97316',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

