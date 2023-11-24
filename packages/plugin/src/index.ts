// import * as Serverless from 'serverless';
// import * as Plugin from 'serverless/classes/Plugin';
// import {setLog, setServerless} from './serverless';
import {useBus} from './bus';
import {useAWSCredentials} from './credentials';

// class ServerlessLiveLambda implements Plugin {
//   hooks: Plugin.Hooks;
//   commands?: Plugin.Commands | undefined;

//   constructor(
//     serverless: Serverless,
//     cliOptions: Serverless.Options,
//     {log}: Plugin.Logging
//   ) {
//     setServerless(serverless);
//     setLog(log);

//     this.hooks = {
//       'setDomainName:set': this.startBus.bind(this),
//     };

//     this.commands = {
//       setDomainName: {
//         usage: 'Helps you start your first Serverless plugin',
//         lifecycleEvents: ['set'],
//         // options: {
//         //   domainName: {
//         //     usage:
//         //       'Specify the domain name you want to set ' +
//         //       '(e.g. "--domain-name \'my-app\'" or "-dn \'my-app\'")',
//         //     required: true,
//         //     shortcut: 'dn',
//         //   },
//         // },
//       },
//     };
//   }

//   startBus() {
//     console.log('Weoll');
//   }
// }

// export = ServerlessLiveLambda;

import * as Serverless from 'serverless';
import {setLog, setServerless, useLog, useServerless} from './serverless';
import {useIOTEndpoint} from './iot';

class ServerlessPlugin {
  serverless: Serverless;
  options: any;

  commands: {};
  hooks: {[key: string]: Function};

  constructor(serverless: Serverless, options: any, {log}: any) {
    setServerless(serverless);
    setLog(log);

    this.serverless = serverless;
    this.options = options;

    this.commands = {
      welcome: {
        usage: 'Helps you start your first Serverless plugin',
        lifecycleEvents: ['hello', 'world'],
        options: {
          message: {
            usage:
              'Specify the message you want to deploy ' +
              '(e.g. "--message \'My Message\'" or "-m \'My Message\'")',
            required: true,
            shortcut: 'm',
          },
        },
      },
    };

    this.hooks = {
      'before:welcome:hello': this.beforeWelcome.bind(this),
      'welcome:hello': this.welcomeUser.bind(this),
      'welcome:world': this.displayHelloMessage.bind(this),
      'after:welcome:world': this.afterHelloWorld.bind(this),
    };
  }

  beforeWelcome() {
    this.serverless.cli.log('Hello from Serverless!');
  }

  welcomeUser() {
    this.serverless.cli.log('Your message:');
    useAWSCredentials();

    useIOTEndpoint().then(endpoint => {
      this.serverless.cli.log(endpoint);
    });
  }

  displayHelloMessage() {
    this.serverless.cli.log(`${this.options.message}`);
  }

  afterHelloWorld() {
    this.serverless.cli.log('Please come again!');
  }
}

module.exports = ServerlessPlugin;
