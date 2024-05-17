const {build} = require('esbuild');

// Build serverless-live-lambda
build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  packages: 'external',
  platform: 'node',
  outfile: 'dist/index.js',
});

// // Build support/nodejs/runtime
// build({
//   entryPoints: ['support/nodejs/runtime/index.ts'],
//   format: 'esm',
//   bundle: true,
//   sourcemap: true,
//   packages: 'external',
//   platform: 'node',
//   outfile: 'dist/support/nodejs/runtime.js',
// });
