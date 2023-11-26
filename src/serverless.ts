import Plugin from 'serverless/classes/Plugin';
import Serverless from 'serverless';
import { lazy, } from './utils/lazy';

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

export const useFunctions = lazy(() => {
  const log = useLog();
  const functions = sls.service.functions!;
  const functionIds = Object.values(functions).map(func => func.name!);
  log.info('functions', functionIds);

  const result = {
    all: functions,
    fromId: (id: string) => {
      return Object.values(functions).find(func => func.name === id);
    },
  };
  return result;
});
