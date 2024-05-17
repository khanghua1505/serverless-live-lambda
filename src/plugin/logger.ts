import chalk from 'chalk';
import randColor from 'randomcolor';

import {useFunctions, useLog} from './serverless';
import {lazy} from './utils/lazy';
import {timeNow} from './utils/time';

const useColorMap = lazy(() => {
  const colorMap = new Map<string, string>();
  const functions = useFunctions().all;
  for (const func of Object.values(functions)) {
    colorMap.set(func.name!, randColor({luminosity: 'light'}));
  }
  return colorMap;
});

export const useFunctionLog = (functionId: string) => {
  const log = useLog();
  const colorMap = useColorMap();
  const props = useFunctions().fromId(functionId);
  const color = chalk.hex(colorMap.get(functionId)!);

  return {
    debug: (message: string, ...args: any[]) => {
      log.debug(
        `${color(props?.name)} ${color(timeNow())} ${message}`,
        ...args
      );
    },
    info: (message: string, ...args: any[]) => {
      log.notice(
        `${color(props?.name)} ${color(timeNow())} ${message}`,
        ...args
      );
    },
    success: (message: string, ...args: any[]) => {
      log.success(
        `${color(props?.name)} ${color(timeNow())} ${message}`,
        ...args
      );
    },
    warning: (message: string, ...args: any[]) => {
      log.warning(
        `${color(props?.name)} ${color(timeNow())} ${message}`,
        ...args
      );
    },
    danger: (message: string, ...args: any[]) => {
      log.error(
        `${color(props?.name)} ${color(timeNow())} ${message}`,
        ...args
      );
    },
    bold: chalk.bold,
    all: chalk,
    hex: chalk.hex,
    primary: chalk.hex('#FF9000'),
  };
};

export const useGlobalLog = () => {
  const log = useLog();

  return {
    debug: (message: string, ...args: any[]) => {
      log.debug(`${message}`, ...args);
    },
    info: (message: string, ...args: any[]) => {
      log.notice(`${message}`, ...args);
    },
    success: (message: string, ...args: any[]) => {
      log.success(`${message}`, ...args);
    },
    warning: (message: string, ...args: any[]) => {
      log.warning(`${message}`, ...args);
    },
    danger: (message: string, ...args: any[]) => {
      log.error(`${message}`, ...args);
    },
    bold: chalk.bold,
    all: chalk,
    hex: chalk.hex,
    primary: chalk.hex('#FF9000'),
  };
};
