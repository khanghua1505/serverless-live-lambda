import {isDebug, useFunctions} from '../serverless.js';
import {lazy} from '../utils/lazy.js';
import {useBus} from '../bus.js';
import {useFunctionBuilder, useRuntimeHandlers} from './handlers.js';
import {useRuntimeServerConfig} from './server.js';

declare module '../bus.js' {
  export interface Events {
    'worker.started': {
      workerId: string;
      functionId: string;
    };
    'worker.stopped': {
      workerId: string;
      functionId: string;
    };
    'worker.exited': {
      workerId: string;
      functionId: string;
    };
    'worker.stdout': {
      workerId: string;
      functionId: string;
      requestId: string;
      message: string;
    };
  }
}

interface Worker {
  workerId: string;
  functionId: string;
}

export const useRuntimeWorkers = lazy(async () => {
  const workers = new Map<string, Worker>();
  const bus = useBus();
  const builder = useFunctionBuilder();
  const handlers = useRuntimeHandlers();
  const server = await useRuntimeServerConfig();

  handlers.subscribe('function.build.success', async evt => {
    for (const [, worker] of workers) {
      if (worker.functionId === evt.properties.functionId) {
        const props = useFunctions().fromId(worker.functionId);
        if (!props) {
          return;
        }
        const handler = handlers.for(props.runtime!);
        await handler?.stopWorker(worker.workerId);
        bus.publish('worker.stopped', worker);
      }
    }
  });

  const lastRequestId = new Map<string, string>();
  bus.subscribe('function.invoked', async evt => {
    bus.publish('function.ack', {
      functionId: evt.properties.functionId,
      workerId: evt.properties.workerId,
    });
    lastRequestId.set(evt.properties.workerId, evt.properties.requestId);
    if (isDebug()) {
      workers.set(evt.properties.workerId, {
        workerId: evt.properties.workerId,
        functionId: evt.properties.functionId,
      });
      return;
    }
    const worker = workers.get(evt.properties.workerId);
    if (worker) return;
    const props = useFunctions().fromId(evt.properties.functionId);
    if (!props) return;
    const handler = handlers.for(props.runtime!);
    if (!handler) return;
    const build = await builder.artifact(evt.properties.functionId);
    if (!build) return;
    await handler.startWorker({
      ...build,
      workerId: evt.properties.workerId,
      functionId: evt.properties.functionId,
      environment: evt.properties.env,
      url: `${server.url}/${evt.properties.workerId}/${server.API_VERSION}`,
      runtime: props.runtime!,
    });
    workers.set(evt.properties.workerId, {
      workerId: evt.properties.workerId,
      functionId: evt.properties.functionId,
    });
    bus.publish('worker.started', {
      workerId: evt.properties.workerId,
      functionId: evt.properties.functionId,
    });
  });

  return {
    fromId(workerId: string) {
      return workers.get(workerId)!;
    },
    getCurrentRequestId(workerId: string) {
      return lastRequestId.get(workerId);
    },
    stdout(workerId: string, message: string) {
      const worker = workers.get(workerId)!;
      bus.publish('worker.stdout', {
        ...worker,
        message: message.trim(),
        requestId: lastRequestId.get(workerId)!,
      });
    },
    exited(workerId: string) {
      const existing = workers.get(workerId);
      if (!existing) return;
      workers.delete(workerId);
      lastRequestId.delete(workerId);
      bus.publish('worker.exited', existing);
    },
    subscribe: bus.forward(
      'worker.started',
      'worker.stopped',
      'worker.exited',
      'worker.stdout'
    ),
  };
});
