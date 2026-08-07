package main

import "testing"

func TestStringParam(t *testing.T) {
	if got := stringParam(map[string]any{"value": "ok"}, "value"); got != "ok" {
		t.Fatalf("expected ok, got %q", got)
	}
}
