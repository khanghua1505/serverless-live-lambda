//go:build wireinject
// +build wireinject

package main

import (
	"github.com/google/wire"

	"examples/todos/internal/http"
	"examples/todos/internal/wiring"
)

func newServer() *http.Server {
	panic(wire.Build(wiring.ProviderSet))
}
