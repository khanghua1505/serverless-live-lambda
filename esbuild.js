const {build} = require('esbuild');
const {bundledDependencies} = require('./package.json');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  external: bundledDependencies,
  platform: 'node',
  outfile: 'dist/index.js',
});
