import type * as Serverless from 'serverless';
import * as Plugin from 'serverless/classes/Plugin';

let sls: Serverless;

export function setServerless(serverless: Serverless) {
  sls = serverless;
}

export const useServerless = () => {
  return sls!;
};

let serverlessLog: Plugin.Logging['log'];

export function setLog(log: Plugin.Logging['log']) {
  serverlessLog = log;
}

export const useLog = () => {
  return serverlessLog!;
};
