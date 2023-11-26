package bridge

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/at-wat/mqtt-go"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/iot"
	"github.com/google/uuid"
	iotdev "github.com/seqsense/aws-iot-device-sdk-go/v6"
)

type iotClient struct {
	dev      iotdev.Device
	clientID string
}

func newIOTClient() *iotClient {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	endpoint := describeIOTEndpoint()
	dialer, err := iotdev.NewPresignDialer(&cfg, endpoint)
	if err != nil {
		log.Fatalf("unable to create mqtt dialer, %v", err)
	}

	clientID := uuid.NewString()
	c, err := iotdev.New(clientID, dialer)
	if err != nil {
		log.Fatalf("unable to create mqtt client, %v", err)
	}

	return &iotClient{
		dev:      c,
		clientID: clientID,
	}
}

func (c *iotClient) Connect(ctx context.Context) error {
	_, err := c.dev.Connect(ctx, c.clientID)
	return err
}

func (c *iotClient) Subscribe(ctx context.Context, topic string) error {
	_, err := c.dev.Subscribe(ctx, mqtt.Subscription{
		Topic: topic,
		QoS:   1,
	})
	return err
}

func (c *iotClient) Publish(ctx context.Context, topic string, data any) error {
	var payload []byte
	switch e := data.(type) {
	case string:
		payload = []byte(e)
	case []byte:
		payload = e
	default:
		var err error
		if payload, err = json.Marshal(data); err != nil {
			return err
		}
	}
	msg := mqtt.Message{
		Topic:   topic,
		QoS:     1,
		Payload: payload,
	}
	return c.dev.Publish(ctx, &msg)
}

func (c *iotClient) Handle(h mqtt.HandlerFunc) {
	c.dev.Handle(h)
}

var iotEndpoint string

func describeIOTEndpoint() string {
	sync.OnceFunc(func() {
		cfg, err := config.LoadDefaultConfig(context.Background())
		if err != nil {
			log.Fatalf("unable to load SDK config, %v", err)
		}
		c := iot.NewFromConfig(cfg)
		output, err := c.DescribeEndpoint(context.Background(), &iot.DescribeEndpointInput{
			EndpointType: aws.String("iot:Data-ATS"),
		})
		if err != nil {
			log.Fatalf("unable to describe AWS Iot endpoint, %v", err)
		}
		iotEndpoint = *output.EndpointAddress
	})()

	return iotEndpoint
}
