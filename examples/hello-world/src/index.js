
const crypto = require('crypto');
const bridge = require('serverless-live-lambda-node-bridge');

exports.handler = bridge(async (event) => {
  const result = {}
  for (let i = 0; i < 20000; i++) {
    const randStr = crypto.randomBytes(48).toString('base64')
    result[i] = randStr
  }

  const body = JSON.stringify(result, null, 2);
  const payloadSize = Math.ceil(body.length / 1024);
  console.log(`Payload size ${payloadSize} KB`);

  return {
    statusCode: 200,
    body,
  }
});
