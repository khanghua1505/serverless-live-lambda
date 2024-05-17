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
