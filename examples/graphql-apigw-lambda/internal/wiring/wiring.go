package wiring

import (
	"github.com/google/wire"

	"examples/graphql-apigw-lambda/internal/api"
	"examples/graphql-apigw-lambda/internal/graph"
	"examples/graphql-apigw-lambda/internal/http"
)

var ProviderSet = wire.NewSet(
	http.NewServer,
	api.NewResolver,

	wire.Bind(new(graph.ResolverRoot), new(*api.Resolver)),
)
