import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { minify } from 'terser';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'renderers/shared/00-api-client.js',
  'renderers/shared/01-theme.js',
  'renderers/shared/02-components.js',
  'renderers/shared/03-slideouts.js',
  'renderers/dashboard.js',
];
const chunks = [];
for (const file of files) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  if (file.endsWith('01-theme.js')) {
    chunks.push(source);
    continue;
  }
  const result = await minify(source, {
    compress: false,
    mangle: false,
    format: { comments: false, semicolons: true },
  });
  if (!result.code) throw new Error(`Terser produced no output for ${file}`);
  chunks.push(result.code);
}
const dashboardBundle = chunks.join('\n');

const rawBytes = Buffer.byteLength(dashboardBundle);
const gzipBytes = zlib.gzipSync(dashboardBundle, { level: 9 }).length;
const rawBudget = 670 * 1024;
const gzipBudget = 115 * 1024;

console.log(JSON.stringify({
  raw_bytes: rawBytes,
  gzip_bytes: gzipBytes,
  raw_budget_bytes: rawBudget,
  gzip_budget_bytes: gzipBudget,
}));

if (rawBytes > rawBudget || gzipBytes > gzipBudget) {
  console.error('Dashboard bundle exceeds its release budget.');
  process.exit(1);
}
