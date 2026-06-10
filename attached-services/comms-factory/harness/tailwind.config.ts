import type { Config } from 'tailwindcss';

/**
 * Tailwind tokens map 1:1 onto the design-system CSS variables defined in
 * app/globals.css (folded from the Claude Code Design v3 pass). Existing
 * utility classes (text-state-approved, bg-paper, text-ink-3, …) resolve to
 * the same canteloupe paper-and-ink palette as the hand-written design CSS,
 * and theme switching works via the `.theme-dark` class on <html>.
 */
const config: Config = {
  darkMode: ['class', '.theme-dark'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      // Literal hex values from the design's locked paper palette (styles.css
      // :root). Kept literal (not var()) so Tailwind opacity modifiers like
      // `bg-state-rejected/40` resolve correctly in the existing components.
      // The hand-written design CSS owns dark-mode via .theme-dark.
      colors: {
        ink: {
          DEFAULT: '#1a1814',
          2: '#3d3a35',
          3: '#74706a',
          4: '#a7a39c',
        },
        paper: '#fbf9f4',
        canvas: {
          DEFAULT: '#f3efe6',
          2: '#ece7dc',
        },
        rule: {
          DEFAULT: '#e2dccf',
          strong: '#cdc6b8',
        },
        accent: {
          DEFAULT: '#FE6F39',
          ink: '#b54515',
          tint: '#fbe6da',
        },
        state: {
          pending: '#a7a39c',
          running: '#2f6cd0',
          awaiting: '#b87a0f',
          approved: '#3a7a55',
          edited: '#b54515',
          rejected: '#a14a36',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
    },
  },
  plugins: [],
};

export default config;
