import {} from 'serverless/classes/Service';
import {useLog, useServerless} from './serverless';
import {lazy} from './utils/lazy';

export const useAWSProvider = lazy(() => {
  const sls = useServerless();
  const provider = sls.getProvider('aws');
  if (!provider) {
    throw new Error('serverless-live-lambda: only AWS is supported');
  }
  return provider;
});

export const useAWSCredentials = lazy(async () => {
  const provider = useAWSProvider();
  const {credentials} = provider.getCredentials();
  return credentials;
});

const useClientCache = lazy(() => new Map<string, any>());

export function useAWSClient<C>(client: new (config: any) => C, force = false) {
  const log = useLog();
  const cache = useClientCache();
  const existing = cache.get(client.name);
  if (existing && !force) return existing as C;
  const [provider, credentials] = [useAWSProvider(), useAWSCredentials()];
  const result = new client({
    region: provider.getRegion(),
    credentials: credentials,
  });
  cache.set(client.name, result);
  log.debug(`Created AWS client ${client.name}`);
  return result;
}
