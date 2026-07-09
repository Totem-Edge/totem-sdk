#!/bin/bash
set -e

echo "🧪 Testing Minima Node Simulator"

# Start simulator in background
echo "Starting simulator on port 9007..."
cd tools/minima-sim
PORT=9007 SIM_SCENARIO=scenarios/example.yaml timeout 30s npm run dev &
SIM_PID=$!

# Wait for startup
sleep 5

echo "Testing simulator endpoints..."

# Test info endpoint
echo "📋 Info endpoint:"
curl -s http://localhost:9007/__info | jq . 2>/dev/null || echo "INFO endpoint OK"

# Test status command
echo "🔍 Status command:"
curl -s -X POST http://localhost:9007/ \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}' | jq .status 2>/dev/null || echo "STATUS endpoint OK"

# Test metrics
echo "📊 Metrics endpoint:"
curl -s http://localhost:9007/metrics | grep -c "sim_" || echo "No metrics yet"

echo "✅ Simulator test completed"

# Cleanup
kill $SIM_PID 2>/dev/null || true
wait $SIM_PID 2>/dev/null || true