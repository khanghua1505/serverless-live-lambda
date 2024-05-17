import zlib from 'node:zlib';

export function gzip(input: string | Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(input, (err, buf) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(buf);
    });
  });
}
