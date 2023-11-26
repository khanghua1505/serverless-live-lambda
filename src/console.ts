import chalk from 'chalk';
import randColor from 'randomcolor';
import {FunctionDefinitionHandler, FunctionDefinitionImage} from 'serverless';
import {lazy} from './utils/lazy';
import {timeNow} from './utils/time';
import {useBus} from './bus';
import {useColors} from './colors';
import {useFunctions} from './serverless';

export const useFunctionColors = lazy(() => {
  const colorMap = new Map<string, string>();
  const functions = useFunctions().all;
  for (const func of Object.values(functions)) {
    colorMap.set(func.name!, randColor({luminosity: 'light'}));
  }
  return colorMap;
});

interface FunctionMetric {
  startBuildTime: Date;
  stopBuildTime: Date;
}

export const useConsole = lazy(() => {
  const colors = useColors();
  const bus = useBus();
  const colorMap = useFunctionColors();
  const metrics = new Map<string, FunctionMetric>();

  const useFunction = (
    functionId: string
  ): [FunctionDefinitionHandler | FunctionDefinitionImage, chalk.Chalk] => {
    const props = useFunctions().fromId(functionId)!;
    const hex = colorMap.get(functionId)!;
    const color = colors.hex(hex);
    return [props, color];
  };

  const result = {
    getColor: (functionId: string) => {
      const [, color] = useFunction(functionId);
      return color;
    },
  };

  bus.subscribe('function.build.started', evt => {
    let metric = metrics.get(evt.properties.functionId);
    if (!metric) {
      metric = {} as FunctionMetric;
      metrics.set(evt.properties.functionId, metric);
    }
    metric.startBuildTime = new Date();
    const [props, color] = useFunction(evt.properties.functionId);

    colors.line(
      `Starting build ${colors.bold(props.name)}`,
      color(`${props?.name} ${timeNow()}`)
    );
  });

  bus.subscribe('function.build.success', evt => {
    const [props, color] = useFunction(evt.properties.functionId);
    const metric = metrics.get(evt.properties.functionId)!;
    metric.stopBuildTime = new Date();
    const takeTime =
      (metric.stopBuildTime.getTime() - metric.startBuildTime.getTime()) / 1000;

    colors.line(`Done in ${takeTime}s`, color(`${props?.name} ${timeNow()}`));
  });

  bus.subscribe('function.build.failed', evt => {
    const [props, color] = useFunction(evt.properties.functionId);
    colors.line(
      evt.properties.errors.join('\n'),
      color(`${props?.name} ${timeNow()}`)
    );
  });

  bus.subscribe('worker.stdout', evt => {
    const [props, color] = useFunction(evt.properties.functionId);
    colors.line(evt.properties.message, color(`${props?.name} ${timeNow()}`));
  });

  return result;
});
