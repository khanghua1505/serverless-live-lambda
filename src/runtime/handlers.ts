import fs from 'fs/promises';
import path from 'path';
import {FunctionDefinitionHandler, FunctionDefinitionImage} from 'serverless';
import {lazy} from '../utils/lazy';
import {Semaphore} from '../utils/semaphore.js';
import {useBus} from '../bus';
import {useFunctions, useServerless} from '../serverless';
import {useGlobalLog} from '../logger';
import {useGoHandler} from './handlers/go';
import {useWatcher} from '../watcher';

declare module '../bus.js' {
  export interface Events {
    'function.build.started': {
      functionId: string;
    };
    'function.build.success': {
      functionId: string;
    };
    'function.build.failed': {
      functionId: string;
      errors: string[];
    };
  }
}

interface BuildInput {
  functionId: string;
  out: string;
  props: FunctionDefinitionHandler | FunctionDefinitionImage;
}

export interface StartWorkerInput {
  url: string;
  workerId: string;
  functionId: string;
  environment: Record<string, string>;
  out: string;
  handler: string;
  runtime: string;
}

interface ShouldBuildInput {
  file: string;
  functionId: string;
}

export interface RuntimeHandler {
  startWorker: (worker: StartWorkerInput) => Promise<void>;
  stopWorker: (workerID: string) => Promise<void>;
  shouldBuild: (input: ShouldBuildInput) => boolean;
  canHandle: (runtime: string) => boolean;
  build: (input: BuildInput) => Promise<
    | {
        type: 'success';
        handler: string;
        sourcemap?: string;
      }
    | {
        type: 'error';
        errors: string[];
      }
  >;
}

export const useRuntimeHandlers = lazy(() => {
  const handlers: RuntimeHandler[] = [useGoHandler()];
  const sls = useServerless();
  const bus = useBus();

  const pendingBuilds = new Map<string, any>();

  const result = {
    subscribe: bus.forward('function.build.success', 'function.build.failed'),
    register: (handler: RuntimeHandler) => {
      handlers.push(handler);
    },
    for: (runtime: string) => {
      const result = handlers.find(x => x.canHandle(runtime));
      if (!result) {
        throw new Error(`${runtime} runtime is unsupported`);
      }
      return result;
    },
    async build(functionId: string) {
      async function task() {
        const func = useFunctions().fromId(functionId);

        if (!func) {
          return {
            type: 'error' as const,
            errors: [`Function with ID "${functionId}" not found`],
          };
        }
        const handler = result.for(func.runtime!);
        const serverlessDir = path.join(sls.serviceDir, '.serverless');
        const out = path.join(serverlessDir, 'artifacts', functionId);
        await fs.rm(out, {recursive: true, force: true});
        await fs.mkdir(out, {recursive: true});

        bus.publish('function.build.started', {functionId});

        const built = await handler!.build({
          functionId,
          out,
          props: func!,
        });
        if (built.type === 'error') {
          bus.publish('function.build.failed', {
            functionId,
            errors: built.errors,
          });
          return built;
        }

        bus.publish('function.build.success', {functionId});
        return {
          ...built,
          out,
          sourcemap: built.sourcemap,
        };
      }

      const log = useGlobalLog();

      if (pendingBuilds.has(functionId)) {
        log.debug('Waiting on pending build', functionId);
        return pendingBuilds.get(functionId)! as ReturnType<typeof task>;
      }
      const promise = task();
      pendingBuilds.set(functionId, promise);
      log.debug('Building function', functionId);
      try {
        return await promise;
      } catch (err) {
        return {
          type: 'error' as const,
          errors: [String(err)],
        };
      } finally {
        pendingBuilds.delete(functionId);
      }
    },
  };

  return result;
});

interface Artifact {
  out: string;
  handler: string;
}

export const useFunctionBuilder = lazy(() => {
  const log = useGlobalLog();
  const artifacts = new Map<string, Artifact>();
  const handlers = useRuntimeHandlers();
  const semaphore = new Semaphore(4);

  const result = {
    artifact: (functionId: string) => {
      if (artifacts.has(functionId)) {
        return artifacts.get(functionId)!;
      }
      return result.build(functionId);
    },
    build: async (functionId: string) => {
      const unlock = await semaphore.lock();
      try {
        const result = await handlers.build(functionId);
        if (!result) return;
        if (result.type === 'error') return;
        artifacts.set(functionId, result);
        return artifacts.get(functionId)!;
      } finally {
        unlock();
      }
    },
  };

  const watcher = useWatcher();
  watcher.subscribe('file.changed', async evt => {
    const functions = useFunctions();
    for (const func of Object.values(functions.all)) {
      const handler = handlers.for(func.runtime!);
      if (
        !handler.shouldBuild({
          functionId: func.name!,
          file: evt.properties.file,
        })
      ) {
        continue;
      }
      await result.build(func.name!);
      log.debug('Rebuilt function', func.name);
    }
  });

  return result;
});
