import chokidar from 'chokidar';
import path from 'path';

import {useBus} from './bus.js';
import {useServerless} from './serverless.js';
import {lazy} from './utils/lazy.js';

declare module './bus.js' {
  export interface Events {
    'file.changed': {
      file: string;
      relative: string;
    };
  }
}

export const useWatcher = lazy(() => {
  const sls = useServerless();
  const bus = useBus();

  const watcher = chokidar.watch([sls.serviceDir], {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    disableGlobbing: false,
    ignored: [
      '**/node_modules/**',
      '**/.build/**',
      '**/.sst/**',
      '**/.git/**',
      '**/debug.log',
      '**/.serverless/**',
      '**/vendor/**',
    ],
    awaitWriteFinish: {
      pollInterval: 100,
      stabilityThreshold: 20,
    },
  });

  watcher.on('change', file => {
    bus.publish('file.changed', {
      file,
      relative: path.relative(sls.serviceDir, file),
    });
  });

  return {
    subscribe: bus.forward('file.changed'),
  };
});
