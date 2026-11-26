import typography from "@tailwindcss/typography";
// Colours, fonts, type scale, radii and motion come from design-tokens.json via the generated preset
// (npm run tokens). Colour utilities read CSS variables, so they follow data-theme.
import tokens from "./tokens.preset.js";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [tokens],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
