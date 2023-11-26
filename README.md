# Serverless Live Lambda

This Serverless plugin forwards the payload from Lambda to the local machine, supporting faster
development cycles. Unlike `serverless-offline`, this plugin does not emulate the Lambda environment;
instead, it directly forwards the payload to the local machine.

**Features:**

- Supports Go λ runtimes. There are plans to support Node.js, Python, and Ruby soon.
- Hot reloads your handler files.

This plugin is updated by its users; I handle maintenance and ensure that pull requests (PRs)
are relevant to the community. In other words, if you find a bug or want a new feature,
please contribute and become one of the contributors! See the contributing section.

## How it differs from SST

SST is great! This plugin was crafted based on the Live Lambda feature of [SST](https://docs.sst.dev/live-lambda-development).
However, there are significant distinctions. Unlike SST, this plugin doesn't create a new personal stack;
instead, it directly utilizes the existing development stack. To achieve this streamlined approach,
it use a bridge library to seamlessly switch and handle the payload between the remote and local machine.

## Installation

First, add `Serverless Live Lambda` to your project:

```bash
npm install serverless-live-lambda --save-dev
```

Then, inside your project's `serverless.yml` file, add the following entry to the plugins section:
`serverless-live-lambda`. If there is no plugin section, you will need to add it to the file.

It should look something like this:

```yaml
plugins:
  - serverless-live-lambda
```

This plugin uses AWS IoT over WebSocket to communicate between your local machine and the remote Lambda function.
For large payloads, it places them into the S3 Serverless deployment bucket. The plugin must allow publishing
and subscribing to AWS IoT Core and getting and putting S3 Serverless Deployment bucket.

The permissions look like this:

```yaml
provider:
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - 's3:GetObject'
            - 's3:DeleteObject'
          Resource:
            - !Sub '${ServerlessDeploymentBucket.Arn}/*'
        - Effect: Allow
          Action:
            - 'iot:Connect'
            - 'iot:DescribeEndpoint'
          Resource: '*'
        - Effect: Allow
          Action:
            - 'iot:Publish'
            - 'iot:Subscribe'
            - 'iot:Receive'
          Resource:
            - 'arn:aws:iot:*:*:topic/serverless/*'
            - 'arn:aws:iot:*:*:topicfilter/serverless/*'
```

## Go Development

Currently, the plugin does not support deploying Go lambdas. For Go lambda deployments,
it is recommended to use the `serverless-go-plugin` to build and deploy your lambda.
Fortunately, this plugin is fully compatible with `serverless-live-lambda`.

It should look something like this:

```yaml
custom:
  go:
    binDir: bin
    cmd: GOARCH=amd64 GOOS=linux go build -ldflags="-s -w"
    supportedRuntimes: ['provided.al2']
    buildProvidedRuntimeAsBootstrap: true

plugins:
  - serverless-go-plugin
```

## Bridge Library

Currently, this plugin exclusively supports the Go runtime, with plans underway to extend support
to additional runtimes. To forward the payload from Lambda, you need to install the bridge library
to your codes.

You can find the libraries here:

| Language | Library                                              |
| -------- | ---------------------------------------------------- |
| Go       | github.com/aboutkh/serverless-live-lambda/support/go |

For Go example:

```go
package main

import (
	bridge "github.com/aboutkh/serverless-live-lambda/support/go"

	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	srv := newServer()
	handler := srv.Setup()
	lambda.Start(bridge.Wrap(handler))
}
```

## Examples

| Name                 | Language | Link                                                                                                         |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| graphql-apigw-lambda | Go       | [Example Link](https://github.com/aboutkh/serverless-live-lambda/tree/main/examples/go/graphql-apigw-lambda) |
