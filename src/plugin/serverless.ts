import Serverless from 'serverless';
import Plugin from 'serverless/classes/Plugin';

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
  let filtered = functions;
  let regex = new RegExp('.*');

  return {
    get all() {
      return filtered;
    },
    applyFilter: (pattern: string) => {
      regex = new RegExp(pattern);
      filtered = Object.keys(functions)
        .filter(func => {
          return regex.test(func);
        })
        .reduce((prev, current) => {
          return {
            ...prev,
            [current]: functions[current],
          };
        }, {});
    },
    fromId: (id: string) => {
      return Object.values(filtered).find(func => func.name === id);
    },
  };
});

let serverlessOpts: any;

export const setServerlessOptions = (opts: any) => {
  serverlessOpts = opts;
};

export const useServerlessOptions = () => {
  return serverlessOpts;
};

let debug = false;

export const setDebugMode = () => {
  debug = true;
};

export const isDebug = () => {
  return debug;
};
