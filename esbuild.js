const {build} = require('esbuild');
const {dependencies} = require('./package.json');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  external: Object.keys(dependencies),
  platform: 'node',
  outfile: 'dist/index.js',
});
