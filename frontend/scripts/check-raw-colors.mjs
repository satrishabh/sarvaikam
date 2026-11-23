#!/usr/bin/env node
// Fails when a raw hex colour appears in src/ outside src/styles/tokens.css.
// Colours belong in design-tokens.json; use var(--color-*) in CSS or a token utility (bg-surface) in TSX.
// Escape hatch for a deliberate exception: put `allow-raw-color` in a comment on the same line.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src");
const ALLOWED_FILES = new Set(["src/styles/tokens.css"]);
const EXTENSIONS = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".html", ".svg"]);
// #rgb, #rgba, #rrggbb, #rrggbbaa not preceded by a word character or & (skips &#123; entities and ids like a#b).
const RAW_HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (ALLOWED_FILES.has(rel)) continue;
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (line.includes("allow-raw-color")) return;
      for (const match of line.matchAll(RAW_HEX)) problems.push(`${rel}:${index + 1}:${match.index + 1}  ${match[0]}`);
    });
}

if (problems.length) {
  console.error(`lint:colors: ${problems.length} raw hex colour(s) outside src/styles/tokens.css:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("Add the colour to design-tokens.json, run `npm run tokens`, and use the variable or utility instead.");
  process.exit(1);
}
console.log("lint:colors: no raw hex colours in src/ outside src/styles/tokens.css");
