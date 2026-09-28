// Concatenates src/ into one self-contained HTML file.
//   dist/rumblevale.html  – artifact body (no doctype; the Artifact publisher wraps it)
//   index.html            – standalone page for local play / static hosting
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const head = readFileSync(join(src, 'head.html'), 'utf8');
const css = readFileSync(join(src, 'style.css'), 'utf8');
const body = readFileSync(join(src, 'body.html'), 'utf8');
const jsDir = join(src, 'js');
const js = readdirSync(jsDir)
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => `// ---- ${f} ----\n` + readFileSync(join(jsDir, f), 'utf8'))
  .join('\n');

const page = `${head}\n<style>\n${css}\n</style>\n${body}\n<script>\n"use strict";\n(function(){\n${js}\n})();\n</script>\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'rumblevale.html'), page);
writeFileSync(
  join(root, 'index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${page}</body>\n</html>\n`
);
console.log(`built: ${(page.length / 1024).toFixed(1)} KB`);
