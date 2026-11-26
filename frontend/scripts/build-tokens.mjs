#!/usr/bin/env node
// Builds every styling artifact from design-tokens.json, the single source of design tokens.
//   src/styles/tokens.css  CSS custom properties: light on :root, dark and high-contrast behind data-theme
//   tokens.preset.js       Tailwind preset whose colours read the CSS variables, so utilities follow the theme
//   ../website/tokens.css  the same variables for the static marketing site (no reader themes)
// No dependencies: run with `node scripts/build-tokens.mjs` (or `npm run tokens`).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "design-tokens.json");
const CSS_OUT = join(root, "src", "styles", "tokens.css");
const PRESET_OUT = join(root, "tokens.preset.js");
const WEBSITE_DIR = join(root, "..", "website");
const WEBSITE_OUT = join(WEBSITE_DIR, "tokens.css");

const BASE_SET = "Sarvaikam";
const THEME_SETS = { dark: "Sarvaikam-dark", contrast: "Sarvaikam-contrast" };

const fail = (message) => {
  console.error(`build-tokens: ${message}`);
  process.exit(1);
};

const tokens = JSON.parse(readFileSync(SOURCE, "utf8").replace(/^﻿/, ""));
const base = tokens[BASE_SET];
if (!base?.color) fail(`${BASE_SET}.color is missing from design-tokens.json`);

const kebab = (name) => String(name).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const isToken = (node) => node && typeof node === "object" && "$value" in node;
const entries = (group) => Object.entries(group ?? {}).filter(([key]) => !key.startsWith("$"));
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ALIAS = /^\{([^}]+)\}$/;

function hexToChannels(hex) {
  let digits = hex.slice(1);
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)).join(" ");
}

// Colours: { name: { kind: "hex", hex } | { kind: "alias", target } }
function readColors(group, setName) {
  const colors = {};
  for (const [name, token] of entries(group)) {
    if (!isToken(token)) fail(`${setName}.color.${name} has no $value`);
    const value = String(token.$value).trim();
    const alias = value.match(ALIAS);
    if (alias) {
      const [prefix, target] = alias[1].split(".");
      if (prefix !== "color" || !target) fail(`${setName}.color.${name}: only {color.<name>} aliases are supported`);
      colors[name] = { kind: "alias", target };
    } else if (HEX.test(value)) {
      colors[name] = { kind: "hex", hex: value.toLowerCase() };
    } else {
      fail(`${setName}.color.${name}: "${value}" is not a #rgb or #rrggbb colour or an alias`);
    }
  }
  return colors;
}

const baseColors = readColors(base.color, BASE_SET);
for (const [name, color] of Object.entries(baseColors)) {
  if (color.kind === "alias" && !baseColors[color.target]) fail(`color.${name} points at unknown color.${color.target}`);
  if (color.kind === "alias" && baseColors[color.target].kind === "alias") fail(`color.${name}: aliases of aliases are not supported`);
}
const themes = {};
for (const [theme, setName] of Object.entries(THEME_SETS)) {
  const overrides = readColors(tokens[setName]?.color, setName);
  for (const name of Object.keys(overrides)) {
    if (!baseColors[name]) fail(`${setName}.color.${name} overrides a colour that ${BASE_SET} does not define`);
    if (baseColors[name].kind === "alias") fail(`${setName}.color.${name} is an alias in ${BASE_SET}; override its target instead`);
  }
  themes[theme] = overrides;
}

// A camelCase alias (accentStrong) kept for design tools would emit the same variable as its
// kebab-case target (accent-strong), so it is skipped in code outputs.
const shadowedAlias = (name) => /[A-Z]/.test(name) && kebab(name) in baseColors;

const colorDecls = (colors) =>
  Object.entries(colors).filter(([name]) => !shadowedAlias(name)).flatMap(([name, color]) => {
    const v = `--color-${kebab(name)}`;
    return color.kind === "hex"
      ? [`${v}: ${color.hex};`, `${v}-rgb: ${hexToChannels(color.hex)};`]
      : [`${v}: var(--color-${kebab(color.target)});`, `${v}-rgb: var(--color-${kebab(color.target)}-rgb);`];
  });

function scalarDecls() {
  const out = [];
  for (const [name, t] of entries(base.font?.family)) out.push(`--font-${kebab(name)}: ${t.$value.join(", ")};`);
  for (const [name, t] of entries(base.font?.size)) out.push(`--text-${kebab(name)}: ${t.$value};`);
  for (const [name, t] of entries(base.font?.lineHeight)) out.push(`--leading-${kebab(name)}: ${t.$value};`);
  for (const [name, t] of entries(base.space)) out.push(`--space-${kebab(name)}: ${t.$value};`);
  for (const [name, t] of entries(base.radius)) out.push(`--radius-${kebab(name)}: ${t.$value};`);
  for (const [name, t] of entries(base.motion?.duration)) out.push(`--duration-${kebab(name)}: ${t.$value};`);
  for (const [name, t] of entries(base.motion?.easing)) out.push(`--ease-${kebab(name)}: cubic-bezier(${t.$value.join(", ")});`);
  for (const [name, t] of entries(base.dimension)) out.push(`--dimension-${kebab(name)}: ${t.$value};`);
  return out;
}

// Reader themes: a palette per theme on :root (Reader settings swatches use it), then the
// data-reader-theme blocks that point --reader-* at one palette. The first theme is the default.
function readerCss() {
  const readerThemes = entries(base.reader);
  if (!readerThemes.length) return { palette: [], blocks: [] };
  const palette = [];
  const blocks = [];
  readerThemes.forEach(([theme, group], index) => {
    const decls = [];
    const scheme = group.$extensions?.["com.sarvaikam"]?.colorScheme;
    if (scheme) decls.push(`color-scheme: ${scheme};`);
    for (const [role, token] of entries(group)) {
      const value = String(token.$value).toLowerCase();
      if (!HEX.test(value)) fail(`reader.${theme}.${role}: "${value}" is not a #rgb or #rrggbb colour`);
      palette.push(`--reader-${kebab(theme)}-${kebab(role)}: ${value};`);
      decls.push(`--reader-${kebab(role)}: var(--reader-${kebab(theme)}-${kebab(role)});`);
    }
    blocks.push(block(index === 0 ? "html[data-reader-theme]" : `html[data-reader-theme="${theme}"]`, decls));
  });
  return { palette, blocks };
}

const block = (selector, decls, indent = "") =>
  `${indent}${selector} {\n${decls.map((d) => `${indent}  ${d}`).join("\n")}\n${indent}}`;

function buildCss({ withReader }) {
  const reader = withReader ? readerCss() : { palette: [], blocks: [] };
  const durations = entries(base.motion?.duration).map(([name]) => `--duration-${kebab(name)}: 0.01ms;`);
  const parts = [
    `/* GENERATED by scripts/build-tokens.mjs from design-tokens.json. Do not edit; run \`npm run tokens\`. */`,
    `/* Colours: var(--color-x) for a solid colour, rgb(var(--color-x-rgb) / 0.5) for one with alpha. */`,
    block(":root", [...colorDecls(baseColors), ...scalarDecls(), ...reader.palette]),
    `/* Dark is opt-in: set data-theme="dark", or data-theme="auto" to follow the device setting. */`,
    block(':root[data-theme="dark"]', ["color-scheme: dark;", ...colorDecls(themes.dark)]),
    `@media (prefers-color-scheme: dark) {\n${block(':root[data-theme="auto"]', ["color-scheme: dark;", ...colorDecls(themes.dark)], "  ")}\n}`,
    block(':root[data-theme="contrast"]', ["color-scheme: light;", ...colorDecls(themes.contrast)]),
    `@media (prefers-reduced-motion: reduce) {\n${block(":root", durations, "  ")}\n}`,
  ];
  if (reader.blocks.length) parts.push(`/* Lesson reader page themes (Reader settings). */`, ...reader.blocks);
  return parts.join("\n\n") + "\n";
}

function buildPreset() {
  const colors = {};
  for (const name of Object.keys(baseColors)) {
    if (/[A-Z]/.test(name)) continue; // camelCase names are aliases kept for design tools, not utilities
    colors[kebab(name)] = `rgb(var(--color-${kebab(name)}-rgb) / <alpha-value>)`;
  }
  const map = (group, prefix) =>
    Object.fromEntries(entries(group).map(([name]) => [kebab(name), `var(--${prefix}-${kebab(name)})`]));
  const preset = {
    theme: {
      extend: {
        colors,
        fontFamily: Object.fromEntries(entries(base.font?.family).map(([name, t]) => [kebab(name), t.$value])),
        fontSize: Object.fromEntries(
          entries(base.font?.size).map(([name]) => [
            kebab(name),
            [`var(--text-${kebab(name)})`, { lineHeight: kebab(name) === "display" || kebab(name) === "headline" ? "var(--leading-heading)" : "var(--leading-body)" }],
          ]),
        ),
        borderRadius: map(base.radius, "radius"),
        transitionDuration: map(base.motion?.duration, "duration"),
        transitionTimingFunction: map(base.motion?.easing, "ease"),
      },
    },
  };
  return [
    "// GENERATED by scripts/build-tokens.mjs from design-tokens.json. Do not edit; run `npm run tokens`.",
    "// Colours read the CSS variables in src/styles/tokens.css, so every utility follows data-theme.",
    `/** @type {import('tailwindcss').Config} */`,
    `export default ${JSON.stringify(preset, null, 2)};`,
    "",
  ].join("\n");
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const previous = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (previous !== content) writeFileSync(path, content, "utf8");
  console.log(`build-tokens: ${previous === content ? "unchanged" : "wrote"} ${relative(root, path).replace(/\\/g, "/")}`);
}

write(CSS_OUT, buildCss({ withReader: true }));
write(PRESET_OUT, buildPreset());
if (existsSync(WEBSITE_DIR)) write(WEBSITE_OUT, buildCss({ withReader: false }));
