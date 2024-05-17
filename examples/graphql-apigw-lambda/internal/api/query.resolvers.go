package api

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-faker/faker/v4"
	"github.com/google/uuid"

	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/graph"
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/graph/model"
)

func (r *queryResolver) Todos(ctx context.Context) ([]*model.Todo, error) {
	count := 15
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
