package bridge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"slices"
	"strings"
	"sync"

	"github.com/at-wat/mqtt-go"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"github.com/google/uuid"
	"golang.org/x/exp/maps"
)

var (
	serverlessApp               = os.Getenv("SLS_SERVICE_NAME")
	serverlessStage             = os.Getenv("SLS_STAGE")
	serverlessLiveLambdaEnabled = strings.ToLower(os.Getenv("SLS_LIVE_LAMBDA_ENABLED"))

	prefix = fmt.Sprintf("serverless/%s/%s", serverlessApp, serverlessStage)

	environmentIgnore = map[string]bool{
		"SLS_SERVICE_NAME":                true,
		"SLS_STAGE":                       true,
		"SLS_LIVE_LAMBDA_ENABLED":         true,
		"AWS_LAMBDA_FUNCTION_MEMORY_SIZE": true,
		"AWS_LAMBDA_LOG_GROUP_NAME":       true,
		"AWS_LAMBDA_LOG_STREAM_NAME":      true,
		"LD_LIBRARY_PATH":                 true,
		"LAMBDA_TASK_ROOT":                true,
		"AWS_LAMBDA_RUNTIME_API":          true,
		"AWS_EXECUTION_ENV":               true,
		"AWS_XRAY_DAEMON_ADDRESS":         true,
		"AWS_LAMBDA_INITIALIZATION_TYPE":  true,
		"PATH":                            true,
		"PWD":                             true,
		"LAMBDA_RUNTIME_DIR":              true,
		"LANG":                            true,
		"NODE_PATH":                       true,
		"TZ":                              true,
		"SHLVL":                           true,
		"_AWS_XRAY_DAEMON_ADDRESS":        true,
		"_AWS_XRAY_DAEMON_PORT":           true,
		"AWS_XRAY_CONTEXT_MISSING":        true,
		"_HANDLER":                        true,
		"_LAMBDA_CONSOLE_SOCKET":          true,
		"_LAMBDA_CONTROL_SOCKET":          true,
		"_LAMBDA_LOG_FD":                  true,
		"_LAMBDA_RUNTIME_LOAD_TIME":       true,
		"_LAMBDA_SB_ID":                   true,
		"_LAMBDA_SERVER_PORT":             true,
		"_LAMBDA_SHARED_MEM_FD":           true,
	}
)

type Bride struct {
	iot *iotClient
}

type Fragment struct {
	ID    string `json:"id"`
	Index int    `json:"index"`
	Count int    `json:"count"`
	Data  string `json:"data"`
}

type Chunk map[int]Fragment

type MessageProps struct {
	WorkerID     string                      `json:"workerId"`
	RequestID    string                      `json:"requestId"`
	FunctionID   string                      `json:"functionId"`
	Deadline     int64                       `json:"deadline"`
	Event        json.RawMessage             `json:"event"`
	Context      lambdacontext.LambdaContext `json:"context"`
	Env          map[string]string           `json:"env"`
	Body         json.RawMessage             `json:"body"`
	ErrorMessage string                      `json:"errorMessage"`
}

type Message struct {
	Type       string       `json:"type"`
	Properties MessageProps `json:"properties"`
}

func NewBride() *Bride {
	iot := newIOTClient()

	return &Bride{
		iot: iot,
	}
}

var onMessage func(context.Context, Message)
var environments = make(map[string]string)
var fragments = make(map[string]Chunk)

func (b *Bride) Switch(ctx context.Context, e json.RawMessage) (any, error) {
	sync.OnceFunc(func() {
		if err := b.iot.Connect(ctx); err != nil {
			log.Panicf("connect to AWS Iot Core failed %v\n", err)
		}

		topic := fmt.Sprintf("%s/events/%s", prefix, b.iot.clientID)
		b.iot.Subscribe(ctx, topic)

		for _, env := range os.Environ() {
			pair := strings.Split(env, "=")
			key, value := pair[0], pair[1]
			if _, ok := environmentIgnore[key]; !ok {
				environments[key] = value
			}
		}

		b.iot.Handle(func(m *mqtt.Message) {
			var frag Fragment
			if err := json.Unmarshal(m.Payload, &frag); err != nil {
				log.Printf("unmarshal mqtt payload error %v\n", err)
				return
			}
			log.Printf("got fragment %s index %d\n", frag.ID, frag.Index)
			pending, ok := fragments[frag.ID]
			if !ok {
				pending = make(Chunk)
				fragments[frag.ID] = pending
			}
			pending[frag.Index] = frag
			if len(pending) == int(frag.Count) {
				log.Printf("got all fragments %s\n", frag.ID)
				delete(fragments, frag.ID)
				cmp := func(a Fragment, b Fragment) int {
					return a.Index - b.Index
				}
				var data string
				parts := maps.Values(pending)
				slices.SortFunc(parts, cmp)
				for _, frag := range parts {
					data += frag.Data
				}
				var evt Message
				if err := json.Unmarshal([]byte(data), &evt); err != nil {
					log.Printf("unmarshal evt payload error %v\n", err)
					return
				}
				onMessage(ctx, evt)
			}
		})
	})()

	lambdaCtx, ok := lambdacontext.FromContext(ctx)
	if !ok {
		return nil, errors.New("get lambda context failed")
	}
	deadline, _ := ctx.Deadline()

	msg := Message{
		Type: "function.invoked",
		Properties: MessageProps{
			WorkerID:   b.iot.clientID,
			RequestID:  lambdaCtx.AwsRequestID,
			FunctionID: lambdacontext.FunctionName,
			Deadline:   deadline.UnixMilli(),
			Event:      e,
			Context:    *lambdaCtx,
			Env:        environments,
		},
	}
	if err := b.publish(ctx, msg); err != nil {
		return nil, err
	}

	done := make(chan Message)
	onMessage = func(ctx context.Context, m Message) {
		if slices.Contains([]string{"function.success", "function.error"}, m.Type) {
			if m.Properties.WorkerID == b.iot.clientID {
				done <- m
			}
		}
	}

	select {
	case result := <-done:
		log.Println("got result", result.Type)
		switch result.Type {
		case "function.success":
			return result.Properties.Body, nil
		case "function.error":
			err := errors.New(result.Properties.ErrorMessage)
			return nil, err
		default:
			return nil, fmt.Errorf("unknown type %s", result.Type)
		}
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			msg := Message{
				Type: "function.timeout",
				Properties: MessageProps{
					WorkerID:   b.iot.clientID,
					RequestID:  lambdaCtx.AwsRequestID,
					FunctionID: lambdacontext.FunctionName,
					Event:      e,
					Context:    *lambdaCtx,
					Env:        environments,
				},
			}
			if err := b.publish(ctx, msg); err != nil {
				return nil, err
			}
		}
	}

	return nil, ctx.Err()
}

func (b *Bride) publish(ctx context.Context, msg Message) error {
	fragments, err := encode(msg)
	if err != nil {
		return fmt.Errorf("encode event error %v", err)
	}
	eventsTopic := fmt.Sprintf("%s/events", prefix)
	for _, fragment := range fragments {
		if err := b.iot.Publish(ctx, eventsTopic, fragment); err != nil {
			return fmt.Errorf("publish error %v", err)
		}
	}

	return nil
}

func encode(in any) ([]Fragment, error) {
	data, err := json.Marshal(in)
	if err != nil {
		return nil, err
	}
	parts := chunk(string(data), 50000)
	id := uuid.NewString()
	var result []Fragment
	for i, part := range parts {
		result = append(result, Fragment{
			ID:    id,
			Index: i,
			Count: len(parts),
			Data:  part,
		})
	}

	return result, nil
}

func chunk(s string, size int) []string {
	var chunks []string
	runes := []rune(s)

	if len(runes) == 0 {
		return []string{s}
	}

	for i := 0; i < len(runes); i += size {
		nn := i + size
		if nn > len(runes) {
			nn = len(runes)
		}
		chunks = append(chunks, string(runes[i:nn]))
	}
	return chunks
}

func Wrap(handler any) any {
	if slices.Contains([]string{"true", "1"}, serverlessLiveLambdaEnabled) {
		b := NewBride()
		return b.Switch
	}
	return handler
}
