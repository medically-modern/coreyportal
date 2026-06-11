/** @type {import('tailwindcss').Config} */

// ── ADHD-informed color system ──────────────────────────────────────────
// Research-backed principles applied here (see DESIGN-COLORS.md):
//  1. DESATURATE EVERYTHING — saturated colors increase visual arousal and
//     cognitive load for ADHD brains. Every hue below is muted ~35-45% vs
//     stock Tailwind, tuned for dark backgrounds.
//  2. ONE MEANING PER COLOR, everywhere:
//       red    = urgent / do now (used ONLY for true urgency — never decorative)
//       amber  = today / warming up / snooze
//       blue   = email channel + "can wait"
//       green  = texts channel + done / good / caught up
//       purple = team questions channel
//       teal   = Elena + primary actions (the single brand accent)
//  3. CALM BASE, QUIET CONTRAST — softened near-neutral dark surfaces,
//     off-white text instead of pure white, to reduce glare and visual noise.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand = calm desaturated teal (matches Elena's identity).
        // The ONE accent for primary actions, so attention isn't split.
        brand: {
          50: '#eef5f5',
          100: '#d8e9e9',
          200: '#b5d4d5',
          300: '#8fbcbe',
          400: '#6da3a6',
          500: '#54898d',
          600: '#427176',
          700: '#345c61',
          800: '#284a4e',
          900: '#1d383c',
        },
        // Near-neutral dark surfaces — slightly warm, less blue glare
        surface: {
          0: '#ffffff',
          50: '#f7f9fa',
          100: '#eef1f4',
          200: '#dde3e9',
          700: '#252c38',
          800: '#1c222c',
          900: '#13181f',
        },
        // Semantic state colors — muted so red still pops, but never screams
        urgent: '#c96a63',
        bad: '#c96a63',
        warn: '#bd9f5e',
        good: '#6ba283',
        // Muted channel hues (override stock Tailwind site-wide)
        blue: {
          100: '#dbe7f3',
          200: '#b7cfe6',
          300: '#93b6d8',
          400: '#7fa6c9',
          500: '#6590b5',
          600: '#50799c',
          700: '#416380',
        },
        green: {
          100: '#ddeee3',
          200: '#bcdcc9',
          300: '#9cc7ab',
          400: '#84b797',
          500: '#6ba283',
          600: '#57896c',
          700: '#467057',
        },
        purple: {
          100: '#e8e2f2',
          200: '#d4c9e6',
          300: '#bfb0d8',
          400: '#a896c7',
          500: '#927eb4',
          600: '#7a679a',
          700: '#645480',
        },
        amber: {
          100: '#f2ead3',
          200: '#e7d7ab',
          300: '#dcc48a',
          400: '#cfb273',
          500: '#bd9f5e',
          600: '#a3884e',
          700: '#87703f',
        },
        red: {
          100: '#f4dedb',
          200: '#eac1bc',
          300: '#e0a39c',
          400: '#d58880',
          500: '#c96a63',
          600: '#b05750',
          700: '#944741',
        },
        orange: {
          100: '#f4e5d8',
          200: '#e8cbb0',
          300: '#ddb189',
          400: '#d39a72',
          500: '#c08355',
          600: '#a76f45',
        },
        yellow: {
          400: '#d3c172',
          500: '#bfae5e',
        },
        cyan: {
          400: '#73aebc',
          500: '#5b96a5',
        },
      },
    },
  },
  plugins: [],
};
