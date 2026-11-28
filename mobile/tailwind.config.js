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
          100: '#dff2ea',
          200: '#bfe6d8',
          300: '#93d3be',
          400: '#58b596',
          500: '#3e9e7f',
          600: '#1f6e5a',
          700: '#175747',
          800: '#123c32',
          900: '#0c2b24',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          foreground: '#ffffff',
        },
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        surfaceVariant: 'rgb(var(--color-surface-variant) / <alpha-value>)',
        card: 'rgb(var(--color-surface) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
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
