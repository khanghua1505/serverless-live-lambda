package api

// This file will be automatically regenerated based on the schema, any resolver implementations
// will be copied through when generating and any unknown code will be moved to the end.
// Code generated by github.com/99designs/gqlgen version v0.17.47

import (
	"context"
	"encoding/json"
	"examples/graphql-apigw-lambda/internal/graph"
	"examples/graphql-apigw-lambda/internal/graph/model"
	"fmt"
	"time"

	faker "github.com/go-faker/faker/v4"
	"github.com/google/uuid"
)

func (r *queryResolver) Todos(ctx context.Context) ([]*model.Todo, error) {
	count := 10000
	models := make([]*model.Todo, count)
	for i := 0; i < count; i++ {
		models[i] = &model.Todo{
			ID:        uuid.NewString(),
			Body:      faker.Paragraph(),
			CreatedOn: time.Now(),
		}
	}
	p, _ := json.Marshal(models)
	size := len(p) / 1024
	fmt.Printf("Payload size %d KB\n", size)
	return models, nil
}

// Query returns graph.QueryResolver implementation.
func (r *Resolver) Query() graph.QueryResolver { return &queryResolver{r} }

type queryResolver struct{ *Resolver }
