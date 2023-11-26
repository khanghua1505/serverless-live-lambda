import Plugin from 'serverless/classes/Plugin';
import Serverless from 'serverless';
import {lazy} from './utils/lazy';

let sls: Serverless;

export const setServerless = (serverless: Serverless) => {
  sls = serverless;
};

export const useServerless = () => {
  return sls!;
};

let serverlessLog: Plugin.Logging['log'];

export const setLog = (log: Plugin.Logging['log']) => {
  serverlessLog = log;
};

export const useLog = () => {
  return serverlessLog!;
};

export const useFunctions = lazy(() => {
  const functions = sls.service.functions!;

  const result = {
    all: functions,
    fromId: (id: string) => {
      return Object.values(functions).find(func => func.name === id);
    },
  };
  return result;
});

let serverlessOpts: any;

export const setServerlessOptions = (opts: any) => {
  serverlessOpts = opts;
};

export const useServerlessOptions = () => {
  return serverlessOpts;
};
