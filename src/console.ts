import randColor from 'randomcolor';
import {lazy} from './utils/lazy';
import {useBus} from './bus';
import {useFunctionLog} from './logger';
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
  const bus = useBus();
  const metrics = new Map<string, FunctionMetric>();

  bus.subscribe('function.build.started', evt => {
    const functionId = evt.properties.functionId;
    const log = useFunctionLog(functionId);
    let metric = metrics.get(functionId);
    if (!metric) {
      metric = {} as FunctionMetric;
      metrics.set(functionId, metric);
    }

    metric.startBuildTime = new Date();
    log.info('🚀 Rebuilding function');
  });

  bus.subscribe('function.build.success', evt => {
    const functionId = evt.properties.functionId;
    const log = useFunctionLog(functionId);
    const metric = metrics.get(functionId)!;

    metric.stopBuildTime = new Date();
    const takenTime =
      (metric.stopBuildTime.getTime() - metric.startBuildTime.getTime()) / 1000;
    log.info(`Done in ${takenTime}s`);
  });

  bus.subscribe('function.build.failed', evt => {
    const log = useFunctionLog(evt.properties.functionId);
    log.info(evt.properties.errors.join('\n'));
  });

  bus.subscribe('worker.stdout', evt => {
    const log = useFunctionLog(evt.properties.functionId);
    log.info(evt.properties.message);
  });
});
