import type {
  Context as LambdaContext,
  Handler as LambdaHandler,
} from 'aws-lambda';
import {v4 as uuidv4} from 'uuid';

import {useIoT} from './iot';

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

  let onresult: (msg: Message) => void;
  let publish: (msg: Message) => Promise<void>;
  let clientId: string;
  let unlock = false;
  useIoT()
    .then(iot => {
      clientId = iot.clientId;

      iot.onconnect(() => {
        iot.subscribe(`${prefix}/events/${iot.clientId}`);
      });

      iot.onmessage((_topic, payload) => {
        const fragment = JSON.parse(payload.toString()) as Fragment;
        console.info(`got fragment ${fragment.id} index ${fragment.index}`);
        let pending = fragments.get(fragment.id);
        if (!pending) {
          pending = new Array<Fragment>(fragment.count);
          fragments.set(fragment.id, pending);
        }
        pending[fragment.index] = fragment;
        if (pending.length === fragment.count) {
          console.info(`got all fragments ${fragment.id}`);
          fragments.delete(fragment.id);
          const parts = pending.sort((a, b) => a.index - b.index);
          let data = '';
          parts.forEach(part => {
            data += part.data;
          });
          const message = JSON.parse(data) as Message;
          onresult(message);
        }
      });

      onresult = (msg: Message) => {
        const {workerId} = msg.properties;
        if (workerId !== iot.clientId) {
          return;
        }
        if (msg.type === 'function.success' || msg.type === 'function.error') {
          results.push(msg);
        }
      };

      publish = async (msg: Message) => {
        const data = JSON.stringify(msg);
        const parts = data.split(/(.{50000})/);
        const id = uuidv4();
        const topic = `${prefix}/events`;
        for (let i = 0; i < parts.length; i += 1) {
          const fragment: Fragment = {
            id,
            index: i,
            count: parts.length,
            data: parts[i],
          };
          await iot.publish(topic, JSON.stringify(fragment));
        }
      };

      // Unlock
      unlock = true;
    })
    .catch(err => console.log(err));

  return async (event: any, context: LambdaContext) => {
    // Wait until for ready
    while (!unlock) {
      await delay(100);
    }

    const msg: Message = {
      type: 'function.invoked',
      properties: {
        workerId: clientId,
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
        return result;
      }
      await delay(100);
    }
  };
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export = (handler: LambdaHandler): LambdaHandler => {
  const isLive = (serverlessLiveLambdaEnabled || '').toLowerCase();
  if (isLive === '1' || isLive === 'true') {
    return Bridge();
  }
  return handler;
};
