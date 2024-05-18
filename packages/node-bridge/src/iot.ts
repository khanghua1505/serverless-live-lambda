import {DescribeEndpointCommand, IoTClient} from '@aws-sdk/client-iot';
import iot from 'aws-iot-device-sdk';
import {v4 as uuidv4} from 'uuid';

const useAWSIoT = () => {
  const client = new IoTClient();
  return {
    describeEndpoint: async () => {
      const command = new DescribeEndpointCommand({
        endpointType: 'iot:Data-ATS',
      });
      const resp = await client.send(command);
      return resp.endpointAddress!;
    },
  };
};

export const useIoT = async () => {
  const client = useAWSIoT();
  const endpoint = await client.describeEndpoint();
  const clientId = uuidv4();
  const device = new iot.device({
    protocol: 'wss',
    host: endpoint,
    clientId: clientId,
    reconnectPeriod: 1,
  });

  return {
    clientId,
    device,
    onconnect: (fn: () => void) => {
      device.on('connect', fn);
    },
    onmessage: (fn: (topic: string, payload: any) => void) => {
      device.on('message', fn);
    },
    subscribe: (topic: string) => {
      return new Promise<void>(r => {
        device.subscribe(topic, {qos: 1}, () => r());
      });
    },
    publish: (topic: string, payload: Buffer | string) => {
      return new Promise<void>(r => {
        device.publish(topic, payload, {qos: 1}, () => r());
      });
    },
  };
};
