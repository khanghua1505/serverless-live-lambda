import {DescribeEndpointCommand, IoTClient} from '@aws-sdk/client-iot';
import iot from 'aws-iot-device-sdk';
import crypto from 'crypto';

export const useIoT = () => {
  let device: iot.device;
  const clientId = crypto.randomUUID();

  return {
    clientId,
    async initDevice() {
      if (device) {
        return device;
      }
      const client = new IoTClient();
      const describeEndpointCmd = new DescribeEndpointCommand({
        endpointType: 'iot:Data-ATS',
      });
      const resp = await client.send(describeEndpointCmd);
      const endpoint = resp.endpointAddress!;
      device = new iot.device({
        protocol: 'wss',
        host: endpoint,
        clientId: clientId,
        reconnectPeriod: 1,
      });
      return device;
    },
  };
};
