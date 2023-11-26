package api

import (
	"context"
	"time"

	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/graph"
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/graph/model"
)

func (r *queryResolver) Todos(ctx context.Context) ([]*model.Todo, error) {
	return []*model.Todo{
		{
			ID:        "1",
			Body:      "Todo 1",
			CreatedOn: time.Now(),
		},
		{
			ID:        "2",
			Body:      "Todo 2",
			CreatedOn: time.Now(),
		},
	}, nil
}

// Query returns graph.QueryResolver implementation.
func (r *Resolver) Query() graph.QueryResolver { return &queryResolver{r} }

type queryResolver struct{ *Resolver }
