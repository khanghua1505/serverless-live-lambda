package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/lambda"
	bridge "github.com/khanghua1505/serverless-live-lambda/packages/go-bridge"
)

func main() {
	lambda.Start(bridge.Wrap(func(ctx context.Context) error {
		fmt.Println("Hello word")
		return nil
	}))
}
