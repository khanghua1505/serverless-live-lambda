package main

import (
	bridge "github.com/aboutkh/serverless-live-lambda/support/go"

	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	br := bridge.NewBride()
	srv := newServer()
	handler := srv.Setup()
	lambda.Start(br.Wrap(handler))
}
