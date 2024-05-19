package wiring

import (
	"github.com/google/wire"

	"examples/todos/internal/api"
	"examples/todos/internal/graph"
	"examples/todos/internal/http"
)

var ProviderSet = wire.NewSet(
	http.NewServer,
	api.NewResolver,

	wire.Bind(new(graph.ResolverRoot), new(*api.Resolver)),
)
