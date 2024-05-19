package main

import (
	"context"
	"fmt"

	bridge "github.com/aboutkh/serverless-live-lambda/support/go"

	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	lambda.Start(bridge.Wrap(func(ctx context.Context) error {
		fmt.Println("Hello word")
		return nil
	}))
}
