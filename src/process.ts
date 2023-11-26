/* eslint-disable no-process-exit */
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import {lazy} from './utils/lazy';
import {useAWSClient} from './credentials';
import {useFunctions} from './serverless';
import {useGlobalLog} from './logger';

export const useProcess = lazy(() => {
  const functions = useFunctions().all;
  const log = useGlobalLog();

  process.on('SIGINT', () => {
    const processes = [];
    for (const opts of Object.values(functions)) {
      const cleanup = cleanUpLambda(opts.name!);
      processes.push(cleanup);
    }
    Promise.all(processes)
      .then(() => process.exit(0))
      .catch(err => {
        log.danger(
          [
            `Clean up error ${err}`,
            'Please manually remove `SLS_LIVE_LAMBDA_ENABLED=true`.',
          ].join(' ')
        );
        process.exit(1);
      });
  });
});

async function cleanUpLambda(functionId: string) {
  const log = useGlobalLog();
  try {
    const lambda = useAWSClient(LambdaClient);
    const input = new GetFunctionConfigurationCommand({
      FunctionName: functionId,
    });
    const output = await lambda.send(input);
    const envs = output.Environment?.Variables || {};
    delete envs['SLS_LIVE_LAMBDA_ENABLED'];
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionId,
        Environment: {
          Variables: envs,
        },
      })
    );
    log.success(`Clean up ${functionId} success`);
  } catch (err) {
    log.danger(
      [
        `Clean up ${functionId} error`,
        'Please manually remove `SLS_LIVE_LAMBDA_ENABLED=true`.',
      ].join(' ')
    );
  }
}
