import express from 'express';
import https from 'https';
import {Events, useBus} from '../bus.js';
import {getPort} from 'get-port-please';
import {lazy} from '../utils/lazy.js';
import {URL} from 'url';
import {useGlobalLog} from '../logger.js';
import {useRuntimeWorkers} from './workers.js';

export const useRuntimeServerConfig = lazy(async () => {
  const port = await getPort({
    port: 12557,
  });
  return {
    API_VERSION: '2018-06-01',
    port,
    url: `http://localhost:${port}`,
  };
});

export const useRuntimeServer = lazy(async () => {
  const log = useGlobalLog();
  const bus = useBus();
  const app = express();
  const workers = await useRuntimeWorkers();
  const cfg = await useRuntimeServerConfig();

  const workersWaiting = new Map<
    string,
    (evt: Events['function.invoked']) => void
  >();
  const invocationsQueued = new Map<string, Events['function.invoked'][]>();

  function next(workerID: string) {
    const queue = invocationsQueued.get(workerID);
    const value = queue?.shift();
    if (value) return value;

    return new Promise<Events['function.invoked']>(resolve => {
      workersWaiting.set(workerID, resolve);
    });
  }

  workers.subscribe('worker.exited', async evt => {
    const waiting = workersWaiting.get(evt.properties.workerId);
    if (!waiting) return;
    workersWaiting.delete(evt.properties.workerId);
  });

  bus.subscribe('function.invoked', async evt => {
    const worker = workersWaiting.get(evt.properties.workerId);
    if (worker) {
      workersWaiting.delete(evt.properties.workerId);
      worker(evt.properties);
      return;
    }

    let arr = invocationsQueued.get(evt.properties.workerId);
    if (!arr) {
      arr = [];
      invocationsQueued.set(evt.properties.workerId, arr);
    }
    arr.push(evt.properties);
  });

  app.post<{functionId: string; workerId: string}>(
    `/:workerId/${cfg.API_VERSION}/runtime/init/error`,
    express.json({
      strict: false,
      type: ['application/json', 'application/*+json'],
      limit: '10mb',
    }),
    async (req, res) => {
      const worker = workers.fromId(req.params.workerId);
      bus.publish('function.error', {
        requestID: workers.getCurrentRequestId(worker.workerId),
        workerID: worker.workerId,
        functionID: worker.functionId,
        ...req.body,
      });

      res.json('ok');
    }
  );

  app.get<{functionId: string; workerId: string}>(
    `/:workerId/${cfg.API_VERSION}/runtime/invocation/next`,
    async (req, res) => {
      log.debug(
        'Worker',
        req.params.workerId,
        'is waiting for next invocation'
      );
      const payload = await next(req.params.workerId);
      log.debug('Worker', req.params.workerId, 'sending next payload');
      res.set({
        'Lambda-Runtime-Aws-Request-Id': payload.context.awsRequestId,
        'Lambda-Runtime-Deadline-Ms': Date.now() + payload.deadline,
        'Lambda-Runtime-Invoked-Function-Arn':
          payload.context.invokedFunctionArn,
        'Lambda-Runtime-Client-Context': JSON.stringify(
          payload.context.clientContext || null
        ),
        'Lambda-Runtime-Cognito-Identity': JSON.stringify(
          payload.context.identity || null
        ),
        'Lambda-Runtime-Log-Group-Name': payload.context.logGroupName,
        'Lambda-Runtime-Log-Stream-Name': payload.context.logStreamName,
      });
      res.json(payload.event);
    }
  );

  app.post<{
    workerId: string;
    awsRequestId: string;
  }>(
    `/:workerId/${cfg.API_VERSION}/runtime/invocation/:awsRequestId/response`,
    express.json({
      strict: false,
      type() {
        return true;
      },
      limit: '10mb',
    }),
    (req, res) => {
      log.debug('Worker', req.params.workerId, 'got response', req.body);
      const worker = workers.fromId(req.params.workerId)!;
      bus.publish('function.success', {
        workerId: worker.workerId,
        functionId: worker.functionId,
        requestId: req.params.awsRequestId,
        body: req.body,
      });
      res.status(202).send();
    }
  );

  app.all<{
    href: string;
  }>(
    '/proxy*',
    express.raw({
      type: '*/*',
      limit: '1024mb',
    }),
    (req, res) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, PUT, PATCH, POST, DELETE'
      );
      res.header(
        'Access-Control-Allow-Headers',
        req.header('access-control-request-headers')
      );

      if (req.method === 'OPTIONS') return res.send();
      const u = new URL(req.url.substring(7));
      const forward = https.request(
        u,
        {
          headers: {
            ...req.headers,
            host: u.hostname,
          },
          method: req.method,
        },
        proxied => {
          res.status(proxied.statusCode!);
          for (const [key, value] of Object.entries(proxied.headers)) {
            res.header(key, value);
          }
          proxied.pipe(res);
        }
      );
      if (
        req.method !== 'GET' &&
        req.method !== 'DELETE' &&
        req.method !== 'HEAD' &&
        req.body
      ) {
        forward.write(req.body);
      }

      forward.end();
      forward.on('error', e => {
        console.log(e.message);
      });
      return;
    }
  );

  app.post<{
    workerId: string;
    awsRequestId: string;
  }>(
    `/:workerId/${cfg.API_VERSION}/runtime/invocation/:awsRequestId/error`,
    express.json({
      strict: false,
      type: ['application/json', 'application/*+json'],
      limit: '10mb',
    }),
    (req, res) => {
      const worker = workers.fromId(req.params.workerId)!;
      bus.publish('function.error', {
        workerId: worker.workerId,
        functionId: worker.functionId,
        errorType: req.body.errorType,
        errorMessage: req.body.errorMessage,
        requestId: req.params.awsRequestId,
        trace: req.body.trace,
      });
      res.status(202).send();
    }
  );

  log.info(`Runtime server listen on ${cfg.url}`);
  app.listen(cfg.port);
});
