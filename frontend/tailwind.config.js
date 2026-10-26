import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Palette taken from the logo: navy type, one teal accent, gold reserved for "complete".
      colors: {
        canvas: '#F6F7F9',
        surface: '#FFFFFF',
        ink: '#12325A',
        muted: '#5B6B80',
        line: '#E3E7ED',
        track: '#EDF0F4',
        accent: { DEFAULT: '#11828A', strong: '#0C6A71', soft: '#E3F2F3' },
        gold: { DEFAULT: '#E0A945', soft: '#FBF2DF' },
        danger: '#B4232F',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Inter', 'Roboto', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Code"', 'Menlo', 'monospace'],
      },
      letterSpacing: { tightest: '-0.035em' },
      maxWidth: { read: '70ch' },
    },
  },
  plugins: [typography],
};
