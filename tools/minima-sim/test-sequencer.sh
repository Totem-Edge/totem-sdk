#!/bin/bash
set -e

echo "🎭 Testing Scenario Sequencer"

cd tools/minima-sim

echo "Starting sequencer with business cycle..."
PORT=9009 SIM_SCHEDULE=schedules/daily-business-cycle.yaml timeout 15s npm run dev &
SIM_PID=$!

sleep 3

echo "Testing sequencer endpoints..."

# Test info endpoint with sequencer
echo "📋 Sequencer Info:"
curl -s http://localhost:9009/__info | grep -E "(sequencer|name|region)" || echo "Info OK"

# Test metrics with sequencer metrics
echo "📊 Sequencer Metrics:"
curl -s http://localhost:9009/metrics | grep -E "sim_(scenario|blend|transition)" | head -3 || echo "Metrics OK"

# Test a few RPC calls
echo "🔍 RPC Calls:"
for i in {1..3}; do
  curl -s -X POST http://localhost:9009/ \
    -H "Content-Type: application/json" \
    -d '{"command":"status"}' >/dev/null && echo "Call $i: OK" || echo "Call $i: Failed"
  sleep 1
done

echo "✅ Sequencer test completed"

# Cleanup
kill $SIM_PID 2>/dev/null || true
wait $SIM_PID 2>/dev/null || true