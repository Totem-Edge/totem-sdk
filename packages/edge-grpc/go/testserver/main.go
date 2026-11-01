// Test gRPC server for edge-grpc qualification.
//
// It serves raw-byte Echo/ServerStream/ClientStream/Bidi/Slow methods with TLS
// and metadata authentication. The CA certificate and port are printed on
// stdout for the Node test harness.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type rawCodec struct{}

func (rawCodec) Marshal(value any) ([]byte, error) {
	switch message := value.(type) {
	case *[]byte:
		return *message, nil
	case []byte:
		return message, nil
	default:
		return nil, fmt.Errorf("raw codec: unsupported type %T", value)
	}
}

func (rawCodec) Unmarshal(data []byte, value any) error {
	message, ok := value.(*[]byte)
	if !ok {
		return fmt.Errorf("raw codec: unsupported destination %T", value)
	}
	*message = append((*message)[:0], data...)
	return nil
}

func (rawCodec) Name() string { return "proto" }

func main() {
	certificate, caPath, err := generateCertificates()
	if err != nil {
		log.Fatalf("certificates: %v", err)
	}

	server := grpc.NewServer(
		grpc.Creds(credentials.NewTLS(&tls.Config{Certificates: []tls.Certificate{certificate}, MinVersion: tls.VersionTLS12})),
		grpc.ForceServerCodec(rawCodec{}),
		grpc.UnknownServiceHandler(handle),
	)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	fmt.Printf("PORT=%d\n", listener.Addr().(*net.TCPAddr).Port)
	fmt.Printf("CA=%s\n", caPath)

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-signals
		server.Stop()
	}()

	if err := server.Serve(listener); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func handle(_ any, stream grpc.ServerStream) error {
	md, _ := metadata.FromIncomingContext(stream.Context())
	token := os.Getenv("TEST_TOKEN")
	if token == "" {
		token = "test-token"
	}
	if values := md.Get("authorization"); len(values) == 0 || values[0] != token {
		return status.Error(codes.Unauthenticated, "missing or invalid authorization metadata")
	}

	method, _ := grpc.MethodFromServerStream(stream)
	switch {
	case strings.HasSuffix(method, "/Unary"):
		var request []byte
		if err := stream.RecvMsg(&request); err != nil {
			return err
		}
		response := append([]byte(nil), request...)
		return stream.SendMsg(&response)

	case strings.HasSuffix(method, "/ServerStream"):
		var request []byte
		if err := stream.RecvMsg(&request); err != nil {
			return err
		}
		for index := 0; index < 3; index++ {
			message := append(append([]byte(nil), request...), byte(index))
			if err := stream.SendMsg(&message); err != nil {
				return err
			}
		}
		return nil

	case strings.HasSuffix(method, "/ClientStream"):
		total := 0
		for {
			var message []byte
			if err := stream.RecvMsg(&message); err != nil {
				if err == io.EOF {
					break
				}
				return err
			}
			total += len(message)
		}
		response := []byte(fmt.Sprintf("total=%d", total))
		return stream.SendMsg(&response)

	case strings.HasSuffix(method, "/Bidi"):
		for {
			var message []byte
			if err := stream.RecvMsg(&message); err != nil {
				if err == io.EOF {
					return nil
				}
				return err
			}
			response := append([]byte(nil), message...)
			if err := stream.SendMsg(&response); err != nil {
				return err
			}
		}

	case strings.HasSuffix(method, "/Slow"):
		var request []byte
		if err := stream.RecvMsg(&request); err != nil {
			return err
		}
		time.Sleep(500 * time.Millisecond)
		return stream.SendMsg(&request)

	case strings.HasSuffix(method, "/Hang"):
		var request []byte
		if err := stream.RecvMsg(&request); err != nil {
			return err
		}
		if err := stream.SendMsg(&request); err != nil {
			return err
		}
		<-stream.Context().Done()
		return stream.Context().Err()

	default:
		return status.Errorf(codes.Unimplemented, "unknown method %s", method)
	}
}

func generateCertificates() (tls.Certificate, string, error) {
	now := time.Now()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, "", err
	}
	caTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "edge-grpc test CA"},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	if err != nil {
		return tls.Certificate{}, "", err
	}
	caCert, err := x509.ParseCertificate(caDER)
	if err != nil {
		return tls.Certificate{}, "", err
	}

	serverKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, "", err
	}
	serverTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "localhost"},
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"localhost"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
	}
	serverDER, err := x509.CreateCertificate(rand.Reader, serverTemplate, caCert, &serverKey.PublicKey, caKey)
	if err != nil {
		return tls.Certificate{}, "", err
	}

	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})
	directory, err := os.MkdirTemp("", "edge-grpc-cert-")
	if err != nil {
		return tls.Certificate{}, "", err
	}
	caPath := filepath.Join(directory, "ca.pem")
	if err := os.WriteFile(caPath, caPEM, 0600); err != nil {
		return tls.Certificate{}, "", err
	}
	return tls.Certificate{Certificate: [][]byte{serverDER, caDER}, PrivateKey: serverKey}, caPath, nil
}
