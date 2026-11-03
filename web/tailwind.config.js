/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    borderWidth: {
      DEFAULT: '2px',
      '0': '0px',
      '1': '1px',
      '2': '2px',
      '4': '4px',
      '8': '8px',
      hairline: '1px',
    },
    extend: {
      colors: {
        paper: '#ffe17c',
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#b7c6c2',
          muted: '#b7c6c2',
        },
        border: {
          DEFAULT: '#000000',
          strong: '#000000',
          subtle: '#000000',
        },
        navy: {
          sidebar: '#171e19',
          active: '#ffbc2e',
          hover: '#b7c6c2',
        },
        primary: {
          DEFAULT: '#000000',
          hover: '#000000',
          subtle: '#ffe17c',
          border: '#000000',
        },
        saffron: {
          DEFAULT: '#ffbc2e',
          hover: '#ffbc2e',
          subtle: '#ffe17c',
          border: '#000000',
        },
        status: {
          success: {
            text: '#059669',
            bg: '#ECFDF5',
            border: '#000000',
          },
          warning: {
            text: '#D97706',
            bg: '#FFFBEB',
            border: '#000000',
          },
          danger: {
            text: '#DC2626',
            bg: '#FEF2F2',
            border: '#000000',
          },
          neutral: {
            text: '#4B5563',
            bg: '#F3F4F6',
            border: '#000000',
          },
        },
        ink: {
          primary: '#000000',
          secondary: '#171e19',
          muted: 'rgba(0, 0, 0, 0.65)',
          light: 'rgba(0, 0, 0, 0.55)',
          onDark: '#ffffff',
        },
      },
      fontFamily: {
        heading: ['"Cabinet Grotesk"', '"General Sans"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Satoshi"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        none: 'none',
        'hard-sm': '2px 2px 0px 0px #000',
        'hard': '4px 4px 0px 0px #000',
        'hard-lg': '8px 8px 0px 0px #000',
        'hard-xl': '12px 12px 0px 0px #000',
      },
      transitionTimingFunction: {
        press: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
}
