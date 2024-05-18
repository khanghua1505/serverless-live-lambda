/* eslint-disable no-constant-condition */
/* eslint-disable no-process-exit */
import {workerData} from 'node:worker_threads';

import {Context as LambdaContext} from 'aws-lambda';
import http from 'http';
import path from 'path';

const input = workerData;
const file = input.file;

function fetch(req: {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}) {
  return new Promise<{
    statusCode: number;
    headers: Record<string, any>;
    body: string;
  }>((resolve, reject) => {
    const request = http.request(
      input.url + req.path,
      {
        headers: req.headers,
        method: req.method,
      },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          body += chunk.toString();
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode!,
            headers: res.headers,
            body,
          });
        });
      }
    );
    request.on('error', reject);
    if (req.body) request.write(req.body);
    request.end();
  });
}

let request: any;
let response: any;
let context: LambdaContext;

async function error(ex: any) {
  await fetch({
    path: `/runtime/invocation/${context.awsRequestId}/error`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      errorType: 'Error',
      errorMessage: ex.message,
      trace: ex.stack?.split('\n'),
    }),
  });
}
process.on('unhandledRejection', error);

let fn: any;

(async () => {
  try {
    const relative = path.relative(__dirname, file);
    const mod = await import(relative);
    const handler = input.handler;
    fn = mod[handler];
    if (!fn) {
      throw new Error(
        `Function "${handler}" not found in "${
          input.handler
        }". Found ${Object.keys(mod).join(', ')}`
      );
    }
  } catch (ex: any) {
    console.error('Runtime error', ex);
    await fetch({
      path: '/runtime/init/error',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        errorType: 'Error',
        errorMessage: ex.message,
        trace: ex.stack?.split('\n'),
      }),
    });
    process.exit(1);
  }

  while (true) {
    try {
      const result = await fetch({
        path: '/runtime/invocation/next',
        method: 'GET',
        headers: {},
      });
      context = {
        awsRequestId: result.headers['lambda-runtime-aws-request-id'],
        invokedFunctionArn:
          result.headers['lambda-runtime-invoked-function-arn'],
        getRemainingTimeInMillis: () =>
          Math.max(
            Number(result.headers['lambda-runtime-deadline-ms']) - Date.now(),
            0
          ),
        // If identity is null, we want to mimick AWS behavior and return undefined
        identity:
          JSON.parse(result.headers['lambda-runtime-cognito-identity']) ??
          undefined,
        // If clientContext is null, we want to mimick AWS behavior and return undefined
        clientContext:
          JSON.parse(result.headers['lambda-runtime-client-context']) ??
          undefined,
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
        functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION!,
        memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE!,
        logGroupName: result.headers['lambda-runtime-log-group-name'],
        logStreamName: result.headers['lambda-runtime-log-stream-name'],
        callbackWaitsForEmptyEventLoop: {
          set value(_value: boolean) {
            throw new Error(
              '`callbackWaitsForEmptyEventLoop` on lambda Context is not implemented by SST Live Lambda Development.'
            );
          },
          get value() {
            return true;
          },
        }.value,
        done() {
          throw new Error(
            '`done` on lambda Context is not implemented by SST Live Lambda Development.'
          );
        },
        fail() {
          throw new Error(
            '`fail` on lambda Context is not implemented by SST Live Lambda Development.'
          );
        },
        succeed() {
          throw new Error(
            '`succeed` on lambda Context is not implemented by SST Live Lambda Development.'
          );
        },
      };
      request = JSON.parse(result.body);
    } catch (err) {
      console.error('Runtime error', err);
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    try {
      response = await fn(request, context);
    } catch (ex: any) {
      error(ex);
      continue;
    }

    while (true) {
      try {
        await fetch({
          path: `/runtime/invocation/${context.awsRequestId}/response`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(response),
        });
        break;
      } catch (ex) {
        console.error('Runtime error', ex);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
})();
