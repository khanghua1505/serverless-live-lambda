package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	bridge "github.com/khanghua1505/serverless-live-lambda/packages/go-bridge"
)

func main() {
	srv := newServer()
	handler := srv.Setup()
	lambda.Start(bridge.Wrap(handler))
}
