package wiring

import (
	"github.com/google/wire"

	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/api"
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/graph"
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/http"
)

var ProviderSet = wire.NewSet(
	http.NewServer,
	api.NewResolver,

	wire.Bind(new(graph.ResolverRoot), new(*api.Resolver)),
)
