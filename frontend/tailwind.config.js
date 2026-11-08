import typography from "@tailwindcss/typography";
import { createRequire } from "node:module";
const tokens = createRequire(import.meta.url)("./design-tokens.json").Sarvaikam;
const color = (name) => tokens.color[name].$value;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // White surfaces, warm orange accents, and gold reserved for completed lessons.
      colors: {
        canvas: color("canvas"),
        surface: color("surface"),
        ink: color("ink"),
        muted: color("muted"),
        line: color("line"),
        track: color("track"),
        accent: {
          DEFAULT: color("accent"),
          strong: color("accentStrong"),
          soft: color("accentSoft"),
        },
        gold: { DEFAULT: color("gold"), soft: color("goldSoft") },
        danger: color("danger"),
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Inter",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Segoe UI"',
          "Inter",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          '"SF Mono"',
          '"Cascadia Code"',
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: { tightest: "-0.035em" },
      maxWidth: { read: "68ch" },
      keyframes: {
        pop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        rise: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        burst: {
          "0%": { transform: "scale(.4) rotate(0deg)", opacity: "1" },
          "100%": { transform: "scale(2.2) rotate(45deg)", opacity: "0" },
        },
      },
      animation: {
        pop: "pop .45s cubic-bezier(.2,.9,.3,1.4)",
        rise: "rise .3s cubic-bezier(.2,.8,.2,1)",
        burst: "burst .6s ease-out forwards",
      },
    },
  },
  plugins: [typography],
};
