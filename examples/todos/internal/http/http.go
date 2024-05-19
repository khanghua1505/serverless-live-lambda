package http

import (
	"context"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/aws/aws-lambda-go/events"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"

	"examples/todos/internal/graph"
)

type Server struct {
	r graph.ResolverRoot
}

func NewServer(resolver graph.ResolverRoot) *Server {
	return &Server{
		r: resolver,
	}
}

func (s *Server) Setup() any {
	gin.SetMode(gin.ReleaseMode)

	r := gin.Default()
	r.POST("/graphql", graphqlHandler(s.r))
	r.GET("/", playgroundHandler())
	adapter := ginadapter.NewV2(r)

	return func(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
		return adapter.ProxyWithContext(ctx, req)
	}
}

func graphqlHandler(r graph.ResolverRoot) gin.HandlerFunc {
	h := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: r,
	}))

	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL", "/graphql")

	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
