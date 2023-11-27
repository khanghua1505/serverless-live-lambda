import {isDebug} from '../serverless.js';
import {lazy} from '../utils/lazy.js';
import {useBus} from '../bus.js';
import {useIOT} from '../iot.js';

declare module '../bus.js' {
  export interface Events {
    'function.ack': {
      workerId: string;
      functionId: string;
    };
    'function.invoked': {
      workerId: string;
      functionId: string;
      requestId: string;
      env: Record<string, any>;
      event: any;
      context: any;
      deadline: number;
    };
    'function.success': {
      workerId: string;
      functionId: string;
      requestId: string;
      body: any;
    };
    'function.error': {
      workerId: string;
      functionId: string;
      errorType: string;
      errorMessage: string;
      requestId: string;
      trace: string[];
    };
  }
}

export const useIOTBridge = lazy(async () => {
  const bus = useBus();
  const iot = await useIOT();
  const topic = `${iot.prefix}/events`;
  const debug = isDebug();

  const cache = new Map<string, string>();

  if (debug) {
    bus.subscribe('function.invoked', evt => {
      cache.set(evt.properties.requestId, evt.properties.workerId);
      evt.properties.workerId = evt.properties.functionId;
    });
  }

  bus.subscribe('function.success', async evt => {
    if (debug) {
      evt.properties.workerId = cache.get(evt.properties.requestId)!;
      cache.delete(evt.properties.requestId);
    }
    iot.publish(
      topic + '/' + evt.properties.workerId,
      'function.success',
      evt.properties
    );
  });
  bus.subscribe('function.error', async evt => {
    if (debug) {
      evt.properties.workerId = cache.get(evt.properties.requestId)!;
      cache.delete(evt.properties.requestId);
    }
    iot.publish(
      topic + '/' + evt.properties.workerId,
      'function.error',
      evt.properties
    );
  });
  bus.subscribe('function.ack', async evt => {
    iot.publish(
      topic + '/' + evt.properties.workerId,
      'function.ack',
      evt.properties
    );
  });
});
