/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#B6FF4A',
          dark: '#8FCC2A',
          muted: '#B6FF4A33',
        },
        surface: {
          DEFAULT: '#111114',
          raised: '#18181D',
          overlay: '#1E1E25',
        },
        text: {
          primary: '#F5F5F7',
          secondary: '#8A8A9A',
          muted: '#4A4A5A',
        },
        accent: {
          cyan: '#4AFFD4',
          red: '#FF4A6A',
          amber: '#FFB84A',
        },
        severity: {
          low: '#4AFFD4',
          medium: '#FFB84A',
          high: '#FF8A4A',
          critical: '#FF4A6A',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '4px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.35s ease forwards',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
