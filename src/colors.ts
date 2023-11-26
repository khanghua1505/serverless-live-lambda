import chalk from 'chalk';
import {lazy} from './utils/lazy';
import {useLog} from './serverless';

export const useColors = lazy(() => {
  const log = useLog();
  let last: 'line' | 'gap' = 'gap';

  const result = {
    line: (message?: any, ...optionalParams: any[]) => {
      last = 'line';
      log.notice(`${[...optionalParams, message].join(' ')}`);
    },
    success: (message?: any, ...optionalParams: any[]) => {
      last = 'line';
      log.success(`${[...optionalParams, message].join(' ')}`);
    },
    warning: (message?: any, ...optionalParams: any[]) => {
      last = 'line';
      log.warning(`${[...optionalParams, message].join(' ')}`);
    },
    danger: (message?: any, ...optionalParams: any[]) => {
      last = 'line';
      log.error(`${[...optionalParams, message].join(' ')}`);
    },
    mode(input: typeof last) {
      last = input;
    },
    gap() {
      if (last === 'line') {
        last = 'gap';
        log.notice();
      }
    },
    dim: chalk.dim,
    bold: chalk.bold,
    all: chalk,
    hex: chalk.hex,
    primary: chalk.hex('#FF9000'),
    link: chalk.cyan,
    prefix: chalk.bold('| '),
  };

  return result;
});
