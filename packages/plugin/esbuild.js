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
  // format: 'esm',
  packages: 'external',
  platform: 'node',
  outfile: 'dist/node-ric/index.cjs',
});
