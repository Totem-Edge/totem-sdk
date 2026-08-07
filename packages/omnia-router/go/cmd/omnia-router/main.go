package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	omniarouter "github.com/totem-sdk/omnia-router"
)

type request struct {
	ID     any            `json:"id"`
	Method string         `json:"method"`
	Params map[string]any `json:"params"`
}

type response struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   string `json:"error,omitempty"`
}

func main() {
	graph := omniarouter.NewChannelGraph()
	in := bufio.NewScanner(os.Stdin)
	out := json.NewEncoder(os.Stdout)

	for in.Scan() {
		var req request
		if err := json.Unmarshal(in.Bytes(), &req); err != nil {
			_ = out.Encode(response{JSONRPC: "2.0", Error: err.Error()})
			continue
		}
		result, err := dispatch(graph, req.Method, req.Params)
		resp := response{JSONRPC: "2.0", ID: req.ID, Result: result}
		if err != nil {
			resp.Result = nil
			resp.Error = err.Error()
		}
		_ = out.Encode(resp)
	}
}

func dispatch(graph *omniaRouter.ChannelGraph, method string, params map[string]any) (any, error) {
	switch method {
	case "health":
		return map[string]any{"ok": true}, nil
	case "addChannel":
		graph.AddChannel(channelEdge(params))
		return map[string]any{"ok": true}, nil
	case "removeChannel":
		channelID, ok := params["channelId"].(string)
		if !ok || channelID == "" {
			return nil, fmt.Errorf("channelId is required")
		}
		graph.RemoveChannel(channelID)
		return map[string]any{"ok": true}, nil
	case "findRoute":
		from, err := requiredStringParam(params, "from")
		if err != nil { return nil, err }
		to, err := requiredStringParam(params, "to")
		if err != nil { return nil, err }
		amount, err := requiredStringParam(params, "amount")
		if err != nil { return nil, err }
		tokenID, err := requiredStringParam(params, "tokenId")
		if err != nil { return nil, err }
		return omniarouter.FindRoute(
			graph,
			from,
			to,
			amount,
			tokenID,
			&omniaRouter.RouteOptions{MaxHops: intParam(params, "maxHops", 8)},
		), nil
	default:
		return nil, fmt.Errorf("unknown method: %s", method)
	}
}

func channelEdge(params map[string]any) omniaRouter.ChannelGraphEdge {
	return omniaRouter.ChannelGraphEdge{
		ChannelID:        stringParam(params, "channelId"),
		From:             stringParam(params, "from"),
		To:               stringParam(params, "to"),
		TokenID:          stringParam(params, "tokenId"),
		AvailableBalance: stringParam(params, "availableBalance"),
		HTLCCapacity:     stringParam(params, "htlcCapacity"),
		FeeRate:          stringParam(params, "feeRate"),
	}
}

func stringParam(params map[string]any, key string) string {
	value, _ := params[key].(string)
	return value
}

func requiredStringParam(params map[string]any, key string) (string, error) {
	value := stringParam(params, key)
	if value == "" {
		return "", fmt.Errorf("%s is required", key)
	}
	return value, nil
}

func intParam(params map[string]any, key string, fallback int) int {
	value, ok := params[key].(float64)
	if !ok || value <= 0 {
		return fallback
	}
	return int(value)
}
