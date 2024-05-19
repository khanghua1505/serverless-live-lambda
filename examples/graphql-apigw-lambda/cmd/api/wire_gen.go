// Code generated by Wire. DO NOT EDIT.

//go:generate go run -mod=mod github.com/google/wire/cmd/wire
//go:build !wireinject
// +build !wireinject

package main

import (
	"examples/graphql-apigw-lambda/internal/api"
	"examples/graphql-apigw-lambda/internal/http"
)

// Injectors from wire.go:

func newServer() *http.Server {
	resolver := api.NewResolver()
	server := http.NewServer(resolver)
	return server
}
