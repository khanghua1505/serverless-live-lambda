
const crypto = require('crypto');
const bridge = require('serverless-live-lambda-node-bridge');

exports.handler = bridge(async (event) => {
  const result = {}
  for (let i = 0; i < 100; i++) {
    const randStr = crypto.randomBytes(48).toString('base64')
    result[i] = randStr
  }
  return {
    statusCode: 200,
    body: JSON.stringify(result, null, 2),
  }
});
