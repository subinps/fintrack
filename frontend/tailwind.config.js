import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';
import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: ['index.html', 'src/**/*.{js,ts,jsx,tsx,html,css}'],
    theme: {
        container: {
            center: true,
            padding: {
                DEFAULT: '1.25rem',
                sm: '1.5rem',
                lg: '2rem'
            },
            screens: {
                '2xl': '1440px'
            }
        },
        extend: {
            fontFamily: {
                sans: ['Inter Variable', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
                mono: ['JetBrains Mono Variable', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
            },
            fontSize: {
                '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
                micro: ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.12em' }],
                display: ['clamp(2rem, 1.2rem + 3.2vw, 3.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '600' }],
                'display-sm': ['clamp(1.5rem, 1.1rem + 1.4vw, 2rem)', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }]
            },
            colors: {
                border: {
                    DEFAULT: 'hsl(var(--border))',
                    strong: 'hsl(var(--border-strong))'
                },
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                surface: {
                    DEFAULT: 'hsl(var(--surface))',
                    strong: 'hsl(var(--surface-strong))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                    soft: 'hsl(var(--primary-soft))',
                    strong: 'hsl(var(--primary-strong))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                success: {
                    DEFAULT: 'hsl(var(--success))',
                    foreground: 'hsl(var(--success-foreground))'
                },
                warning: {
                    DEFAULT: 'hsl(var(--warning))',
                    foreground: 'hsl(var(--warning-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                chart: {
                    1: 'hsl(var(--chart-1))',
                    2: 'hsl(var(--chart-2))',
                    3: 'hsl(var(--chart-3))',
                    4: 'hsl(var(--chart-4))',
                    5: 'hsl(var(--chart-5))'
                }
            },
            borderRadius: {
                sm: '2px',
                md: 'var(--radius-control)',
                lg: 'var(--radius)',
                xl: '6px',
                '2xl': 'var(--radius-panel)',
                '3xl': '10px',
                panel: 'var(--radius-panel)',
                control: 'var(--radius-control)'
            },
            boxShadow: {
                xs: '0 1px 2px 0 rgba(0,0,0,0.05)',
                panel: 'var(--shadow-panel)',
                lifted: 'var(--shadow-lifted)',
                focus: '0 0 0 2px hsl(var(--ring) / 0.35)'
            },
            transitionTimingFunction: {
                out: 'cubic-bezier(0.16, 1, 0.3, 1)',    /* Quiza-style snappy easing */
                'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' }
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' }
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                'slide-up': {
                    '0%': { transform: 'translateY(12px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                'scale-in': {
                    '0%': { transform: 'scale(0.96)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' }
                },
                'rise-in': {
                    '0%': { transform: 'translateY(6px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                shimmer: {
                    from: { backgroundPosition: '200% 0' },
                    to: { backgroundPosition: '-200% 0' }
                },
                'pulse-subtle': {
                    '0%, 100%': { boxShadow: '0 0 10px -3px hsl(var(--primary) / 0.4)' },
                    '50%': { boxShadow: '0 0 20px -3px hsl(var(--primary) / 0.6)' }
                },
                /* Quiza-style animations */
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                'slide-in-right': {
                    '0%': { opacity: '0', transform: 'translateX(20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' }
                },
                'slide-out-right': {
                    '0%': { opacity: '1', transform: 'translateX(0)' },
                    '100%': { opacity: '0', transform: 'translateX(20px)' }
                },
                'primary-glow': {
                    '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)' },
                    '50%': { boxShadow: '0 0 0 6px hsl(var(--primary) / 0)' }
                },
                'success-flash': {
                    '0%': { backgroundColor: 'hsl(var(--success) / 0.2)' },
                    '100%': { backgroundColor: 'transparent' }
                },
                'error-shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '20%': { transform: 'translateX(-6px)' },
                    '40%': { transform: 'translateX(6px)' },
                    '60%': { transform: 'translateX(-4px)' },
                    '80%': { transform: 'translateX(4px)' }
                },
                'stagger-in': {
                    '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
                },
                'count-up': {
                    '0%': { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                'pulse-ring': {
                    '0%': { boxShadow: '0 0 0 0 hsl(var(--success) / 0.4)' },
                    '70%': { boxShadow: '0 0 0 8px hsl(var(--success) / 0)' },
                    '100%': { boxShadow: '0 0 0 0 hsl(var(--success) / 0)' }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'fade-in': 'fade-in 0.3s ease-out',
                'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                'rise-in': 'rise-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                /* Quiza-style animations */
                'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-out-right': 'slide-out-right 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                'primary-glow': 'primary-glow 2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
                'success-flash': 'success-flash 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'error-shake': 'error-shake 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'stagger-in': 'stagger-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'count-up': 'count-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'pulse-ring': 'pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite'
            }
        }
    },
    plugins: [typography, containerQueries, animate]
};
