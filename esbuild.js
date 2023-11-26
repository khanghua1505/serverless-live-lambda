const {build} = require('esbuild');
const {dependencies = {}, peerDependencies = {}} = require('./package.json');

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  external: [...Object.keys(dependencies), ...Object.keys(peerDependencies)],
  platform: 'node',
  outfile: 'dist/index.js',
});
