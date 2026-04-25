/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── Google brand palette ─────────────────────────────────────────────
      colors: {
        google: {
          blue:   '#4285F4',
          red:    '#EA4335',
          yellow: '#FBBC05',
          green:  '#34A853',
        },
        // Dark surface system
        surface: {
          950: '#080c10',
          900: '#0d1117',
          800: '#161b22',
          700: '#21262d',
          600: '#30363d',
          500: '#484f58',
          400: '#6e7681',
          300: '#8b949e',
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ── Animations ───────────────────────────────────────────────────────
      keyframes: {
        'radar-pulse': {
          '0%, 100%': { opacity: '0.15', transform: 'scale(1)' },
          '50%':       { opacity: '0.45', transform: 'scale(1.05)' },
        },
        'radar-ring': {
          '0%':   { transform: 'scale(0.4)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(66,133,244,0.3)' },
          '50%':       { boxShadow: '0 0 24px 6px rgba(66,133,244,0.6)' },
        },
      },
      animation: {
        'radar-pulse': 'radar-pulse 3s ease-in-out infinite',
        'radar-ring':  'radar-ring 2.5s ease-out infinite',
        'fade-in-up':  'fade-in-up 0.4s ease-out both',
        'shimmer':     'shimmer 2s linear infinite',
        'spin-slow':   'spin-slow 8s linear infinite',
        'glow-pulse':  'glow-pulse 2s ease-in-out infinite',
      },

      // ── Backgrounds ──────────────────────────────────────────────────────
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise':
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },

      // ── Blur / glass ─────────────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      // ── Box shadow ───────────────────────────────────────────────────────
      boxShadow: {
        glass: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        glow:  '0 0 20px rgba(66,133,244,0.4)',
        'glow-red':    '0 0 20px rgba(234,67,53,0.4)',
        'glow-green':  '0 0 20px rgba(52,168,83,0.4)',
        'glow-yellow': '0 0 20px rgba(251,188,5,0.4)',
      },
    },
  },
  plugins: [],
};
