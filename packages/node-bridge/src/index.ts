import zlib from 'node:zlib';

import type {
  Context as LambdaContext,
  Handler as LambdaHandler,
} from 'aws-lambda';
import crypto from 'crypto';

import {useIoT} from './iot';
import {useS3} from './s3';

const serverlessApp = process.env.SLS_SERVICE_NAME!;
const serverlessStage = process.env.SLS_STAGE!;
const serverlessLiveLambdaEnabled = process.env.SLS_LIVE_LAMBDA_ENABLED;

const prefix = `serverless/${serverlessApp}/${serverlessStage}`;

const environmentIgnore: {[k: string]: boolean} = {
  SLS_SERVICE_NAME: true,
  SLS_STAGE: true,
  SLS_LIVE_LAMBDA_ENABLED: true,
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: true,
  AWS_LAMBDA_LOG_GROUP_NAME: true,
  AWS_LAMBDA_LOG_STREAM_NAME: true,
  LD_LIBRARY_PATH: true,
  LAMBDA_TASK_ROOT: true,
  AWS_LAMBDA_RUNTIME_API: true,
  AWS_EXECUTION_ENV: true,
  AWS_XRAY_DAEMON_ADDRESS: true,
  AWS_LAMBDA_INITIALIZATION_TYPE: true,
  PATH: true,
  PWD: true,
  LAMBDA_RUNTIME_DIR: true,
  LANG: true,
  NODE_PATH: true,
  TZ: true,
  SHLVL: true,
  _AWS_XRAY_DAEMON_ADDRESS: true,
  _AWS_XRAY_DAEMON_PORT: true,
  AWS_XRAY_CONTEXT_MISSING: true,
  _HANDLER: true,
  _LAMBDA_CONSOLE_SOCKET: true,
  _LAMBDA_CONTROL_SOCKET: true,
  _LAMBDA_LOG_FD: true,
  _LAMBDA_RUNTIME_LOAD_TIME: true,
  _LAMBDA_SB_ID: true,
  _LAMBDA_SERVER_PORT: true,
  _LAMBDA_SHARED_MEM_FD: true,
};

interface Fragment {
  id: string;
  index: number;
  count: number;
  data: string;
}

type RemoveMethods<T> = {
  [P in keyof T as T[P] extends (...args: any) => any ? never : P]: T[P];
};

interface MessageProps {
  bucket?: string;
  key?: string;
  gzip?: boolean;

  workerId: string;
  requestId: string;
  functionId: string;
  deadline: number;
  event: string;
  body?: string;
  context: RemoveMethods<LambdaContext>;
  env: {
    [key: string]: string;
  };

  errorMessage?: string;
}

interface Message {
  type: string;
  properties: MessageProps;
}

function Bridge(): LambdaHandler {
  const fragments = new Map<string, Array<Fragment>>();
  const results = Array<Message>();
  const environments: {[key: string]: string} = {};
  for (const [envName, val] of Object.entries(process.env)) {
    if (!environmentIgnore[envName]) {
      environments[envName] = val!;
    }
  }

  const s3 = useS3();
  const iot = useIoT();

  const promise = iot.initDevice();
  promise.then(device => {
    device.on('connect', () => {
      device.subscribe(`${prefix}/events/${iot.clientId}`, {qos: 1});
    });

    device.on('message', async (topic: string, payload: any) => {
      const fragment = JSON.parse(payload.toString()) as Fragment;
      console.info(`got fragment ${fragment.id} index ${fragment.index}`);
      let pending = fragments.get(fragment.id);
      if (!pending) {
        pending = new Array<Fragment>();
        fragments.set(fragment.id, pending);
      }
      pending.push(fragment);
      if (pending.length < fragment.count) {
        return;
      }
      console.info(`got all fragments ${fragment.id}`);
      fragments.delete(fragment.id);
      const parts = pending.sort((a, b) => a.index - b.index);
      let data = '';
      parts.forEach(part => {
        data += part.data;
      });
      try {
        let message = JSON.parse(data) as Message;
        if (message.type !== 'pointer') {
          onresult(message);
          return;
        }
        const {key, bucket} = message.properties;
        const body = await s3.getObject(bucket!, key!);
        s3.delObject(bucket!, key!).catch(err =>
          console.error('Delete object error', err)
        );
        let buf = body;
        if (message.properties.gzip) {
          buf = await unzip(body);
        }
        message = JSON.parse(buf.toString('utf-8'));
        onresult(message);
      } catch (err) {
        console.error('Parse error', err);
      }
    });
  });

  const publish = async (msg: Message) => {
    const device = await promise;
    const data = JSON.stringify(msg);
    const parts = data.split(/(.{50000})/);
    const id = crypto.randomUUID();
    const topic = `${prefix}/events`;
    parts.forEach((part, i) => {
      const fragment: Fragment = {
        id,
        index: i,
        count: parts.length,
        data: part,
      };
      const buf = JSON.stringify(fragment);
      device.publish(topic, buf, {qos: 1}, err => {
        if (err) {
          console.error('publish message error', err);
        }
      });
    });
  };

  const onresult = (msg: Message) => {
    const {workerId} = msg.properties;
    if (workerId !== iot.clientId) {
      return;
    }
    if (msg.type === 'function.success' || msg.type === 'function.error') {
      results.push(msg);
    }
  };

  return async (event: any, context: LambdaContext) => {
    const msg: Message = {
      type: 'function.invoked',
      properties: {
        workerId: iot.clientId,
        requestId: context.awsRequestId,
        functionId: context.functionName,
        deadline: context.getRemainingTimeInMillis(),
        event,
        context,
        env: environments,
      },
    };
    await publish(msg);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (results.length !== 0) {
        const result = results.shift();
        switch (result?.type) {
          case 'function.success':
            return result.properties.body;
          case 'function.error':
            throw new Error(result.properties.errorMessage);
          default:
            throw new Error(`unknown message type ${result?.type}`);
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }
  };
}

function unzip(input: string | Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.unzip(input, (err, buf) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(buf);
    });
  });
}

export = (handler: LambdaHandler): LambdaHandler => {
  const isLive = (serverlessLiveLambdaEnabled || '').toLowerCase();
  if (isLive === '1' || isLive === 'true') {
    return Bridge();
  }
  return handler;
};
