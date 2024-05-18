// const bridge = require('node-bridge');

// exports.handler = bridge.wrap(() => {
//   console.log('Hello world, hello');
// });

// exports.handler

exports.handler = async function (event, context) {
  console.log("EVENT - 111111: \n" + JSON.stringify(event, null, 2));
  return context.logStreamName;
};
