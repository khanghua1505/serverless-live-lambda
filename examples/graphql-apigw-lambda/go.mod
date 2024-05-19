module examples/graphql-apigw-lambda

go 1.21

toolchain go1.22.1

replace github.com/khanghua1505/serverless-live-lambda/packages/go-bridge => ../../packages/go-bridge

require (
	github.com/99designs/gqlgen v0.17.47
	github.com/aboutkh/serverless-live-lambda/examples/go/graphql-apigw-lambda v0.0.0-20240318124231-0c94d9054bad
	github.com/aboutkh/serverless-live-lambda/support/go v0.0.0-20240318124231-0c94d9054bad
	github.com/aws/aws-lambda-go v1.47.0
	github.com/awslabs/aws-lambda-go-api-proxy v0.16.2
	github.com/gin-gonic/gin v1.10.0
	github.com/go-faker/faker/v4 v4.4.1
	github.com/google/uuid v1.6.0
	github.com/google/wire v0.6.0
	github.com/khanghua1505/serverless-live-lambda/packages/go-bridge v0.0.0-00010101000000-000000000000
	github.com/vektah/gqlparser/v2 v2.5.12
)

require (
	github.com/agnivade/levenshtein v1.1.1 // indirect
	github.com/at-wat/mqtt-go v0.18.1 // indirect
	github.com/aws/aws-sdk-go-v2 v1.23.2 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.5.1 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.25.8 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.16.6 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.14.6 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.2.5 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.5.5 // indirect
	github.com/aws/aws-sdk-go-v2/internal/ini v1.7.1 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.2.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.10.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.2.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.10.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.16.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/iot v1.45.3 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.46.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.17.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.20.3 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.25.6 // indirect
	github.com/aws/smithy-go v1.17.0 // indirect
	github.com/bytedance/sonic v1.11.6 // indirect
	github.com/bytedance/sonic/loader v0.1.1 // indirect
	github.com/cloudwego/base64x v0.1.4 // indirect
	github.com/cloudwego/iasm v0.2.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.4 // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/gin-contrib/sse v0.1.0 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.20.0 // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/google/subcommands v1.2.0 // indirect
	github.com/gorilla/websocket v1.5.0 // indirect
	github.com/hashicorp/golang-lru/v2 v2.0.7 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/cpuid/v2 v2.2.7 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/pelletier/go-toml/v2 v2.2.2 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/seqsense/aws-iot-device-sdk-go/v6 v6.1.7 // indirect
	github.com/sosodev/duration v1.3.1 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	github.com/ugorji/go/codec v1.2.12 // indirect
	github.com/urfave/cli/v2 v2.27.2 // indirect
	github.com/xrash/smetrics v0.0.0-20240312152122-5f08fbb34913 // indirect
	golang.org/x/arch v0.8.0 // indirect
	golang.org/x/crypto v0.23.0 // indirect
	golang.org/x/exp v0.0.0-20240112132812-db7319d0e0e3 // indirect
	golang.org/x/mod v0.17.0 // indirect
	golang.org/x/net v0.25.0 // indirect
	golang.org/x/sync v0.7.0 // indirect
	golang.org/x/sys v0.20.0 // indirect
	golang.org/x/text v0.15.0 // indirect
	golang.org/x/tools v0.21.0 // indirect
	google.golang.org/protobuf v1.34.1 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
