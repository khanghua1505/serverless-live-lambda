//go:build wireinject
// +build wireinject

package main

import (
	"github.com/google/wire"

	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/http"
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/wiring"
)

func newServer() *http.Server {
	panic(wire.Build(wiring.ProviderSet))
}
