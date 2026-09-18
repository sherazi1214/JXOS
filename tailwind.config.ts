import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Sora',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        background: '#090B12',
        surface: '#11141D',
        surface2: '#161A26',
        border: '#232838',
        primary: {
          DEFAULT: '#7C6BFF',
          hover: '#6654F0',
          light: '#9C8FFF',
        },
        accent: {
          DEFAULT: '#22D3EE',
          hover: '#0EB8D4',
        },
        success: '#2DD4A7',
        warning: '#F5A524',
        danger: '#F5556C',
        muted: '#8B93A6',
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,107,255,0.15), 0 8px 24px -4px rgba(124,107,255,0.25)',
        'glow-lg': '0 0 0 1px rgba(124,107,255,0.18), 0 16px 48px -8px rgba(124,107,255,0.35)',
        card: '0 1px 2px rgba(0,0,0,0.3), 0 12px 32px -12px rgba(0,0,0,0.55)',
        'card-hover': '0 1px 2px rgba(0,0,0,0.35), 0 20px 40px -12px rgba(124,107,255,0.22)',
        soft: '0 8px 30px -12px rgba(0,0,0,0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'brand-gradient': 'linear-gradient(135deg, #7C6BFF 0%, #22D3EE 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(124,107,255,0.16) 0%, rgba(34,211,238,0.10) 100%)',
        'surface-sheen': 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        float: { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
        'spin-slow': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'pop-in': 'pop-in 0.2s ease-out both',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
