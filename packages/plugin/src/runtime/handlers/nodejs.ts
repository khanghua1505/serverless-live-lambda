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
      project: string;
      handler: string;
      out: string;
      file: string;

      isESM: boolean;

      shouldReload: boolean;

      result?: esbuild.BuildResult;
      ctx?: esbuild.BuildContext;
    }
  > = {};
  const threads = new Map<string, Worker>();

  return {
    shouldBuild: input => {
      const cache = rebuildCache[input.functionId];
      if (!cache) return false;
      if (cache.shouldReload) return true;
      const relative = path
        .relative(cache.project, input.file)
        .split(path.sep)
        .join(path.posix.sep);
      return Boolean(cache.result?.metafile?.inputs[relative]);
    },
    canHandle: input => input.startsWith('nodejs'),
    startWorker: async input => {
      const workers = await useRuntimeWorkers();
      const server = await useRuntimeServerConfig();
      const cache = rebuildCache[input.functionId];
      const nodeRic = cache.isESM
        ? './node-ric/index.mjs'
        : './node-ric/index.cjs';
      new Promise(() => {
        console.log('Start worker');
        const worker = new Worker(path.join(__dirname, nodeRic), {
          env: {
            ...process.env,
            ...input.environment,
            IS_LOCAL: 'true',
            AWS_LAMBDA_RUNTIME_API: `localhost:${server.port}/${input.workerId}`,
          },
          execArgv: ['--enable-source-maps'],
          workerData: {
            ...input,
            out: cache.out,
            file: cache.file,
          },
          stdout: true,
          stdin: true,
          stderr: true,
        });
        worker.stdout.on('data', (data: Buffer) => {
          workers.stdout(input.workerId, data.toString());
        });
        worker.stderr.on('data', (data: Buffer) => {
          workers.stdout(input.workerId, data.toString());
        });
        worker.on('exit', () => {
          workers.exited(input.workerId);
        });
        threads.set(input.workerId, worker);
      });
    },
    stopWorker: async workerId => {
      const worker = threads.get(workerId);
      await worker?.terminate();
    },
    build: async input => {
      const [rootPath, exportFunction] = resolveHandler(input.props.handler);
      const extensions = [
        '.ts',
        '.tsx',
        '.mts',
        '.cts',
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
      ];

      const file = [
        rootPath,
        ...extensions.map(ext => rootPath + ext),
        ...extensions.map(ext => path.join(rootPath, 'index' + ext)),
      ].find(file => {
        return fsSync.existsSync(file);
      });
      if (!file) {
        return {
          type: 'error',
          errors: [`Could not find file for handler "${input.props.handler}"`],
        };
      }

      const project = await findAbove(rootPath || '.', 'package.json');
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

      const canBuild = ['.ts', '.tsx', '.mts', '.cts'].find(ext =>
        file.endsWith(ext)
      );
      if (!canBuild) {
        rebuildCache[input.functionId] = {
          project,
          out: project,
          handler: exportFunction,
          file,
          shouldReload: true,
          isESM,
        };

        return {
          type: 'success',
          handler: exportFunction,
        };
      }

      let ctx = rebuildCache[input.functionId]?.ctx;
      const outdir = path.join(input.out, rootPath);
      if (!ctx) {
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

        ctx = await esbuild.context(options);
      }

      try {
        const result = await ctx.rebuild();
        rebuildCache[input.functionId] = {
          project,
          out: outdir,
          handler: exportFunction,
          file,
          shouldReload: false,
          ctx,
          result,
          isESM,
        };
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

function resolveHandler(handler: string) {
  const parts = handler.split(path.sep);
  const [index, exportFunction] = parts[parts.length - 1].split('.');
  const rootPath = path.join(...parts.slice(0, parts.length - 1), index);
  return [rootPath, exportFunction];
}
