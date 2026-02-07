/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        secondary: {
          DEFAULT: '#10b981', // Emerald 500
          foreground: '#ffffff',
        },
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surfaceVariant: 'rgb(var(--color-surface-variant) / <alpha-value>)',
        card: 'rgb(var(--color-surface) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        onBackground: 'rgb(var(--color-on-background) / <alpha-value>)',
        onSurface: 'rgb(var(--color-on-surface) / <alpha-value>)',
        onSurfaceVariant: 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        outline: 'rgb(var(--color-outline) / <alpha-value>)',
      },
      borderRadius: {
        '3xl': '1.5rem', // 24px
        '4xl': '2rem',   // 32px
      },
    },
  },
  plugins: [],
}
