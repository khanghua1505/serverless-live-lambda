import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export const useS3 = () => {
  const client = new S3Client({});

  return {
    async getObject(bucket: string, key: string): Promise<Buffer> {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const resp = await client.send(cmd);
      const body = await resp.Body?.transformToByteArray();
      return Buffer.from(body!);
    },
    async delObject(bucket: string, key: string) {
      const cmd = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await client.send(cmd);
    },
  };
};
