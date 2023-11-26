/* eslint-disable no-process-exit */
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import {lazy} from './utils/lazy';
import {useAWSClient} from './credentials';
import {useColors} from './colors';
import {useFunctions} from './serverless';

export const useProcess = lazy(() => {
  const colors = useColors();
  const functions = useFunctions().all;

  process.on('SIGINT', () => {
    const processes = [];
    for (const opts of Object.values(functions)) {
      const cleanup = cleanUpLambda(opts.name!);
      processes.push(cleanup);
    }
    Promise.all(processes)
      .then(() => process.exit(0))
      .catch(err => {
        colors.danger(
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
  const colors = useColors();
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
    colors.success(`Clean up ${functionId} success`);
  } catch (err) {
    colors.danger(
      [
        `Clean up ${functionId} error`,
        'Please manually remove `SLS_LIVE_LAMBDA_ENABLED=true`.',
      ].join(' ')
    );
  }
}
