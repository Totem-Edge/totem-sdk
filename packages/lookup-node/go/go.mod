module github.com/totem-sdk/lookup-node

go 1.21

require (
	github.com/mattn/go-sqlite3 v1.14.22
	golang.org/x/crypto v0.24.0
)

require golang.org/x/sys v0.21.0 // indirect

require github.com/totem-sdk/core-ffi v0.0.0

replace github.com/totem-sdk/core-ffi => ../../core/go
