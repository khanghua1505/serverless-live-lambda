import esbuild from 'esbuild';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import {Worker} from 'worker_threads';

import {findAbove} from '../../utils/fs';
import {RuntimeHandler} from '../handlers';
import {useRuntimeServerConfig} from '../server';
import {useRuntimeWorkers} from '../workers';

export const useNodeJsHandler = (): RuntimeHandler => {
  const rebuildCache: Record<
    string,
    {
      result: esbuild.BuildResult;
      ctx: esbuild.BuildContext;
    }
  > = {};
  const sources = new Map<
    string,
    {
      project: string;
      outfile: string;
      handler: string;
    }
  >();
  const threads = new Map<string, Worker>();

  return {
    shouldBuild: input => {
      const cache = rebuildCache[input.functionId];
      if (!cache) return false;
      const parent = sources.get(input.functionId)!;
      const relative = path
        .relative(parent.project, input.file)
        .split(path.sep)
        .join(path.posix.sep);
      return Boolean(cache.result.metafile?.inputs[relative]);
    },
    canHandle: input => input.startsWith('nodejs'),
    startWorker: async input => {
      const workers = await useRuntimeWorkers();
      const server = await useRuntimeServerConfig();
      new Promise((resolve, reject) => {
        const worker = new Worker(
          path.join(__dirname, './support/nodejs/runtime.js'),
          {
            env: {
              ...process.env,
              ...input.environment,
              IS_LOCAL: 'true',
              AWS_LAMBDA_RUNTIME_API: `localhost:${server.port}/${input.workerId}`,
            },
            execArgv: ['--enable-source-maps'],
            workerData: input,
            stdout: true,
            stdin: true,
            stderr: true,
          }
        );
        worker.stdout.on('data', (data: Buffer) => {
          workers.stdout(input.workerId, data.toString());
        });
        worker.stderr.on('data', (data: Buffer) => {
          workers.stdout(input.workerId, data.toString());
        });
        worker.on('exit', code => {
          workers.exited(input.workerId);
          if (code !== 0) {
            reject(code);
            return;
          }
          resolve(code);
        });
        threads.set(input.workerId, worker);
      });
    },
    stopWorker: async workerId => {
      const worker = threads.get(workerId);
      await worker?.terminate();
    },
    build: async input => {
      const [app, handler] = path.basename(input.props.handler).split('.');
      const appRoot = path.join(path.dirname(input.props.handler), app);
      const isDir = (await fs.stat(appRoot)).isDirectory();
      const file = [
        '.ts',
        '.tsx',
        '.mts',
        '.cts',
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
      ]
        .map(ext => (isDir ? path.join(appRoot, 'index' + ext) : appRoot + ext))
        .find(file => {
          return fsSync.existsSync(file);
        });
      if (!file) {
        return {
          type: 'error',
          errors: [`Could not find file for handler "${input.props.handler}"`],
        };
      }

      const project = await findAbove(appRoot || '.', 'package.json');
      if (!project) {
        return {
          type: 'error',
          errors: [
            `Could not find file package.json file for handler "${input.props.handler}"`,
          ],
        };
      }

      const packageJson = JSON.parse(
        await fs.readFile(path.join(project, 'package.json'), {
          encoding: 'utf-8',
        })
      );
      const isESM = (packageJson.type || '') === 'module';

      let ctx = rebuildCache[input.functionId]?.ctx;
      if (!ctx) {
        const outdir = path.join(input.out, app);
        const options: esbuild.BuildOptions = {
          entryPoints: [file],
          platform: 'node',
          packages: 'external',
          bundle: true,
          keepNames: true,
          logLevel: 'silent',
          metafile: true,
          ...(isESM
            ? {
                format: 'esm',
                target: 'esnext',
                mainFields: ['module', 'main'],
                banner: {
                  js: [
                    "import { createRequire as topLevelCreateRequire } from 'module';",
                    'const require = topLevelCreateRequire(import.meta.url);',
                    'import { fileURLToPath as topLevelFileUrlToPath, URL as topLevelURL } from "url"',
                    'const __dirname = topLevelFileUrlToPath(new topLevelURL(".", import.meta.url))',
                  ].join('\n'),
                },
              }
            : {
                format: 'cjs',
                target: 'node16',
              }),
          outdir: outdir,
          sourcemap: true,
        };
        try {
          ctx = await esbuild.context(options);
        } catch (err) {
          console.log(err);
        }

        sources.set(input.functionId, {
          project,
          outfile: '',
          handler,
        });
      }

      try {
        const result = await ctx.rebuild();
        rebuildCache[input.functionId] = {ctx, result};
        return {
          type: 'success',
          handler: input.props.handler,
        };
      } catch (ex: any) {
        const result = ex as esbuild.BuildResult;
        if ('errors' in result) {
          return {
            type: 'error',
            errors: result.errors.flatMap(x => [
              x.text,
              x.location?.file || '',
              x.location?.line + '│' + x.location?.lineText,
            ]),
          };
        }

        return {
          type: 'error',
          errors: [ex.toString()],
        };
      }
    },
  };
};
