const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  packages: 'external',
  platform: 'node',
  outfile: 'dist/index.js',
});

esbuild.build({
  entryPoints: ['src/node-ric/index.ts'],
  bundle: true,
  sourcemap: true,
  platform: 'node',
  outfile: 'dist/node-ric/index.cjs',
});

esbuild.build({
  entryPoints: ['src/node-ric/index.ts'],
  format: 'esm',
  bundle: true,
  sourcemap: true,
  platform: 'node',
  outfile: 'dist/node-ric/index.mjs',
  banner: {
    js: [
      "import { createRequire as topLevelCreateRequire } from 'module';",
      'const require = topLevelCreateRequire(import.meta.url);',
      'import { fileURLToPath as topLevelFileUrlToPath, URL as topLevelURL } from "url"',
      'const __dirname = topLevelFileUrlToPath(new topLevelURL(".", import.meta.url))',
    ].join('\n'),
  },
});
