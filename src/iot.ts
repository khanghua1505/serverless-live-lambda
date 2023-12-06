import {DescribeEndpointCommand, IoTClient} from '@aws-sdk/client-iot';
import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import iot from 'aws-iot-device-sdk';
import {randomUUID} from 'crypto';
import path from 'path';

import {EventPayload, Events, EventTypes, useBus} from './bus';
import {useAWSClient, useAWSCredentials, useAWSProvider} from './credentials';
import {VisibleError} from './errors';
import {useGlobalLog} from './logger';
import {useServerless} from './serverless';
import {lazy} from './utils/lazy';
import {gzip} from './utils/zip';

export const useIOTEndpoint = lazy(async () => {
  const log = useGlobalLog();

  const iot = useAWSClient(IoTClient);
  log.debug('Getting IoT endpoint');
  const response = await iot.send(
    new DescribeEndpointCommand({
      endpointType: 'iot:Data-ATS',
    })
  );
  log.debug(`Using IoT endpoint: ${response.endpointAddress}`);

  if (!response.endpointAddress) {
    throw new VisibleError('IoT Endpoint address not found');
  }

  return response.endpointAddress;
});

export const useIOTClientId = lazy(() => {
  const clientId = randomUUID();
  return clientId;
});

interface Fragment {
  id: string;
  index: number;
  count: number;
  data: string;
}

export const useIOT = lazy(async () => {
  const log = useGlobalLog();
  const bus = useBus();

  const sls = useServerless();
  const endpoint = await useIOTEndpoint();
  const provider = useAWSProvider();
  const creds = await useAWSCredentials();
  const serviceName = sls.service.getServiceName();
  const stage = provider.getStage();

  async function encode(input: any) {
    const s3 = useAWSClient(S3Client);
    const id = randomUUID();
    const json = JSON.stringify(input);
    if (json.length > 1024 * 1024) {
      const deployBucket = await provider.getServerlessDeploymentBucketName();
      const key = path.join('pointers', id);
      const compressed = await gzip(json);
      await s3.send(
        new PutObjectCommand({
          Bucket: deployBucket,
          Key: key,
          Body: compressed,
        })
      );
      return [
        {
          id,
          index: 0,
          count: 1,
          data: JSON.stringify({
            type: 'pointer',
            properties: {
              bucket: deployBucket,
              key: key,
              gzip: true,
            },
          }),
        },
      ];
    }
    const parts = json.match(/.{1,50000}/g);
    if (!parts) return [];
    log.debug(`Encoded iot message into ${parts.length} parts`);
    return parts.map((part, index) => ({
      id,
      index,
      count: parts?.length,
      data: part,
    }));
  }

  const clientId = useIOTClientId();
  const device = new iot.device({
    protocol: 'wss',
    host: endpoint,
    region: provider.getRegion(),
    clientId: clientId,
    accessKeyId: creds.accessKeyId,
    secretKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    reconnectPeriod: 1,
  });
  const PREFIX = `serverless/${serviceName}/${stage}`;
  device.subscribe(`${PREFIX}/events`, {qos: 1});
  log.debug(`Subscribe to ${PREFIX}/events topic`);

  const fragments = new Map<string, Map<number, Fragment>>();

  device.on('connect', () => {
    log.debug('IoT connected');
  });

  device.on('error', (err: unknown) => {
    log.debug(`IoT error ${err}`);
  });

  device.on('close', () => {
    log.debug('IoT closed');
  });

  device.on('reconnect', () => {
    log.debug('IoT reconnected');
  });

  device.on('message', (_topic, buffer) => {
    const fragment = JSON.parse(buffer.toString());
    let pending = fragments.get(fragment.id);
    if (!pending) {
      pending = new Map();
      fragments.set(fragment.id, pending);
    }
    pending.set(fragment.index, fragment);
    if (pending.size === fragment.count) {
      const data = [...pending.values()]
        .sort((a, b) => a.index - b.index)
        .map(item => item.data)
        .join('');
      fragments.delete(fragment.id);
      const evt = JSON.parse(data) as EventPayload;
      bus.publish(evt.type, evt.properties);
    }
  });

  return {
    prefix: PREFIX,
    async publish<Type extends EventTypes>(
      topic: string,
      type: Type,
      properties: Events[Type]
    ) {
      const payload: EventPayload = {
        type,
        properties,
        sourceID: bus.sourceID,
      };
      for (const fragment of await encode(payload)) {
        await new Promise<void>(r => {
          device.publish(
            topic,
            JSON.stringify(fragment),
            {
              qos: 1,
            },
            () => {
              r();
            }
          );
        });
      }
      log.debug(`IOT Published ${topic} ${type}`);
    },
  };
});
