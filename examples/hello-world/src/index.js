
const path = require('path');
const fs = require('fs');
const bridge = require('serverless-live-lambda-node-bridge');

const html = fs.readFileSync(
  path.join(__dirname, './public/index.html'), 
  { encoding:'utf8' },
);

exports.handler = bridge(async () => {
  return {
    statusCode: 200,
    headers: {
        'Content-Type': 'text/html',
    },
    body: html,
  }
});
