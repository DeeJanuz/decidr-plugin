import fs from 'node:fs/promises';
import path from 'node:path';
import { minify } from 'terser';

const root = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.join(root, '.build', 'renderers');
const shared = [
  'renderers/shared/00-api-client.js',
  'renderers/shared/01-theme.js',
  'renderers/shared/02-components.js',
  'renderers/shared/03-slideouts.js',
];
const renderers = [
  ['renderers/list.js', 'decidr-list.js'],
  ['renderers/dashboard.js', 'decidr-dashboard.js'],
  ['renderers/audit-dashboard.js', 'decidr-audit-dashboard.js'],
  ['renderers/audit-reports.js', 'decidr-audit-reports.js'],
  ['renderers/timeline.js', 'decidr-timeline.js'],
  ['renderers/graph.js', 'decidr-graph.js'],
  ['renderers/github-auth.js', 'decidr-github-auth.js'],
];

async function releaseSource(relativePath) {
  const source = await fs.readFile(path.join(root, relativePath), 'utf8');
  // The theme is one intentionally long CSS-string expression. Terser's
  // printer recurses through that expression; keep this one module readable.
  if (relativePath.endsWith('01-theme.js')) return source;
  const result = await minify(source, {
    compress: false,
    mangle: false,
    format: { comments: false, semicolons: true },
  });
  if (!result.code) throw new Error(`Terser produced no output for ${relativePath}`);
  return result.code;
}

await fs.mkdir(outputDirectory, { recursive: true });
const sharedSources = await Promise.all(shared.map(releaseSource));

for (const [sourcePath, outputName] of renderers) {
  const rendererSource = await releaseSource(sourcePath);
  const output = [
    '/* Bundled shared dependencies. */',
    ...sharedSources,
    `/* Renderer: ${outputName}. */`,
    rendererSource,
    '',
  ].join('\n');
  await fs.writeFile(path.join(outputDirectory, outputName), output);
}
