const {build} = require('esbuild');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  packages: 'external',
  platform: 'node',
  outfile: 'dist/index.js',
});
