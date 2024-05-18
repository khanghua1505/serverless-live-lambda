// Code generated by Wire. DO NOT EDIT.

//go:generate go run github.com/google/wire/cmd/wire
//go:build !wireinject
// +build !wireinject

package main

import (
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/api"
	"github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda/internal/http"
)

// Injectors from wire.go:

func newServer() *http.Server {
	resolver := api.NewResolver()
	server := http.NewServer(resolver)
	return server
}