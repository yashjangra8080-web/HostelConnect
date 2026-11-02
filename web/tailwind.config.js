/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F4F6FB',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8FAFC',
          muted: '#F1F5F9',
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
          subtle: '#F1F5F9',
        },
        navy: {
          sidebar: '#0C2054',
          active: '#1E3A8A',
          hover: 'rgba(255, 255, 255, 0.08)',
        },
        primary: {
          DEFAULT: '#2F5BD6',
          hover: '#1B43A6',
          subtle: '#EEF2FF',
          border: '#C7D2FE',
        },
        saffron: {
          DEFAULT: '#D95D0F',
          hover: '#B44708',
          subtle: '#FFF7ED',
          border: '#FED7AA',
        },
        status: {
          success: {
            text: '#059669',
            bg: '#ECFDF5',
            border: '#A7F3D0',
          },
          warning: {
            text: '#D97706',
            bg: '#FFFBEB',
            border: '#FDE68A',
          },
          danger: {
            text: '#DC2626',
            bg: '#FEF2F2',
            border: '#FECACA',
          },
          neutral: {
            text: '#4B5563',
            bg: '#F3F4F6',
            border: '#E5E7EB',
          },
        },
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#64748B',
          light: '#94A3B8',
          onDark: '#FFFFFF',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        none: 'none',
        // Hairline boundary focus ring
        focus: '0 0 0 2px #FFFFFF, 0 0 0 4px #2F5BD6',
        'focus-saffron': '0 0 0 2px #FFFFFF, 0 0 0 4px #D95D0F',
        'focus-danger': '0 0 0 2px #FFFFFF, 0 0 0 4px #DC2626',
      },
      borderWidth: {
        hairline: '1px',
      },
    },
  },
  plugins: [],
}
