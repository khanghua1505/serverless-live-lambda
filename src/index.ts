import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import fs from 'fs/promises';
import path from 'path';
import Plugin from 'serverless/classes/Plugin';
import Serverless from 'serverless';
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import {
  setDebugMode,
  setLog,
  setServerless,
  setServerlessOptions,
  useFunctions,
} from './serverless';
import {useAWSClient} from './credentials';
import {useBus} from './bus';
import {useConsole} from './console';
import {useFunctionBuilder} from './runtime/handlers';
import {useGlobalLog} from './logger';
import {useIOT} from './iot';
import {useIOTBridge} from './runtime/iot';
import {useProcess} from './process';
import {useRuntimeServer, useRuntimeServerConfig} from './runtime/server';
import {useRuntimeWorkers} from './runtime/workers';

class ServerlessLiveLambdaPlugin implements Plugin {
  private readonly serverless: any;
  private readonly serviceName: string;
  private readonly stage: string;
  private readonly debug: boolean;
  private readonly filterOpt: string;

  hooks = {
    'start:run': this.run.bind(this),
  };

  commands = {
    start: {
      usage: 'Start your lambda function locally',
      lifecycleEvents: ['run'],
      options: {
        port: {
          usage:
            'Specify API Runtime Server port (e.g. "--port 18080"). Default port is 18080',
          shortcut: 'p',
          type: 'number',
        },
        mode: {
          usage: 'Specify the program mode. Only the value `debug` is allowed.',
          shortcut: 'm',
          type: 'string',
        },
        filter: {
          usage:
            'Utilize a regex pattern to filter the functions. The default is all functions.',
          shortcut: 'f',
          type: 'string',
        },
      },
    },
  };

  constructor(serverless: Serverless, options: any, {log}: Plugin.Logging) {
    this.serverless = serverless;
    this.serverless.service.provider.environment ||= {};
    this.serviceName = serverless.service.getServiceName();
    this.stage = serverless.service.provider.stage;
    this.debug = (options?.mode || options?.m) === 'debug';
    this.filterOpt = options?.filter || options.f || '.*';
    this.loadEnvs();
    if (this.debug) {
      setDebugMode();
    }
    setServerless(serverless);
    setLog(log);
    setServerlessOptions(options);
    this.setServerlessEnvs();
  }

  async run() {
    const log = useGlobalLog();
    await useIOTBridge();

    log.warning(
      [
        'Automatically set SLS_LIVE_LAMBDA_ENABLED=true to forward messages from Lambda to the local machine.',
        'This option poses a potential danger in a production environment,',
        'so please use it exclusively for development purposes.\n',
      ].join(' ')
    );
    useFunctions().applyFilter(this.filterOpt);
    const functions = useFunctions().all;

    if (this.debug) {
      if (Object.keys(functions).length > 1) {
        throw new Error(
          [
            'Debug mode only supports one function at a time.',
            'Please specify your function using the `--filter {function}` option',
            'to enable debugging for the desired function.\n',
          ].join(' ')
        );
      }
      const cfg = await useRuntimeServerConfig();
      const debugFunction = Object.values(functions)[0];
      const envs: Record<string, string> = {
        ...process.env,
        ...debugFunction.environment,
        IS_LOCAL: 'true',
        AWS_LAMBDA_RUNTIME_API: `localhost:${cfg.port}/${debugFunction.name}`,
      };
      const envFile = path.join(process.cwd(), '.serverless', '.env');
      await fs.writeFile(
        envFile,
        Object.keys(envs)
          .map((key: string) => `${key}=${envs[key] || ''}`)
          .join('\n')
      );
      log.success('Write env file success.');
      log.info(
        [
          '\n',
          'Debug mode for the server started successfully.',
          "Now, there's only one step left to debug your code on your local machine.",
          'Configure your debugger to load the generated environment file located at `${workspaceFolder}/.serverless/.env`.\n',
        ].join(' ')
      );
    }

    const promises = Promise.all([
      useProcess(),
      useConsole(),
      useBus(),
      useIOT(),
      useRuntimeWorkers(),
      useRuntimeServer(),
    ]);
    await promises;

    const builder = useFunctionBuilder();
    for (const opts of Object.values(functions)) {
      builder.build(opts.name!);
      this.updateLiveLambdaModeFunctionEnvs(opts.name!);
    }
  }

  private async getLambdaFunctionConfiguration(functionName: string) {
    const lambda = useAWSClient(LambdaClient);
    const input = new GetFunctionConfigurationCommand({
      FunctionName: functionName,
    });
    const output = await lambda.send(input);
    return output;
  }

  private async updateLiveLambdaModeFunctionEnvs(functionId: string) {
    const log = useGlobalLog();
    let envs: Record<string, string> | undefined;
    try {
      const props = await this.getLambdaFunctionConfiguration(functionId);
      envs = props.Environment?.Variables;
    } catch (err) {
      log.danger(
        [
          `Get lambda function ${functionId} configuration error.`,
          'The error may be due to a lack of permission to access the lambda function,',
          'or the function may not be deployed. Ensure that the function is deployed before starting local development.',
        ].join(' ')
      );
      throw err;
    }

    const lambda = useAWSClient(LambdaClient);
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionId,
        Environment: {
          Variables: {
            ...envs,
            SLS_SERVICE_NAME: this.serviceName,
            SLS_STAGE: this.stage,
            SLS_LIVE_LAMBDA_ENABLED: 'true',
          },
        },
      })
    );
  }

  private setServerlessEnvs() {
    const envs: Record<string, string> = {
      SLS_SERVICE_NAME: this.serverless.service.getServiceName(),
      SLS_STAGE: this.serverless.service.provider.stage,
    };
    Object.keys(envs).forEach(key => {
      this.serverless.service.provider.environment[key] = envs[key];
    });
  }

  private loadEnvs() {
    const envFiles = ['.env', `.env.${this.stage}`, `.env.${this.stage}.local`];
    envFiles.map(fileName => {
      const parsed = dotenv.config({path: fileName});
      return dotenvExpand.expand(parsed).parsed;
    });
  }
}

export = ServerlessLiveLambdaPlugin;
