import {randomBytes} from 'crypto';
import {lazy} from './utils/lazy.js';

export type EventPayload = {
  type: string;
  sourceID: string;
  properties: Record<string, unknown>;
};

type Subscription = {
  type: string;
  cb: (payload: any) => void;
};

export const useBus = lazy(() => {
  const subscriptions: Record<string, Subscription[]> = {};

  function subscribers(type: string) {
    let arr = subscriptions[type];
    if (!arr) {
      arr = [];
      subscriptions[type] = arr;
    }
    return arr;
  }

  const sourceID = randomBytes(16).toString('hex');

  const result = {
    sourceID,
    publish(type: string, properties: Record<string, unknown>) {
      const payload: EventPayload = {
        type,
        properties,
        sourceID,
      };

      for (const sub of subscribers(type)) {
        sub.cb(payload);
      }
    },

    unsubscribe(sub: Subscription) {
      const arr = subscribers(sub.type);
      const index = arr.indexOf(sub);
      if (index < 0) return;
      arr.splice(index, 1);
    },

    subscribe(type: string, cb: (payload: EventPayload) => void) {
      const sub: Subscription = {
        type,
        cb,
      };
      subscribers(type).push(sub);
      return sub;
    },
  };

  return result;
});
