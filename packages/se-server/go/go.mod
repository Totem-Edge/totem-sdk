module github.com/totem-sdk/se-server

go 1.21

require (
	github.com/lib/pq v1.10.9
	golang.org/x/crypto v0.24.0
)

require golang.org/x/sys v0.21.0 // indirect

require github.com/totem-sdk/core-ffi v0.0.0

replace github.com/totem-sdk/core-ffi => ../../core/go
