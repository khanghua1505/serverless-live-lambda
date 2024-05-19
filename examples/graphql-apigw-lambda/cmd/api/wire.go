//go:build wireinject
// +build wireinject

package main

import (
	"github.com/google/wire"

	"examples/graphql-apigw-lambda/internal/http"
	"examples/graphql-apigw-lambda/internal/wiring"
)

func newServer() *http.Server {
	panic(wire.Build(wiring.ProviderSet))
}
