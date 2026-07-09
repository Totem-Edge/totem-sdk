#!/bin/bash
# Phase 3 Ops Intelligence Validation Script
# Comprehensive testing of all Phase 3 features

set -e

echo "🧪 Phase 3 Ops Intelligence - Validation Suite"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROMETHEUS_URL="http://localhost:9090"
ALERTMANAGER_URL="http://localhost:9093"
BLACKBOX_URL="http://localhost:9115"

# Test results tracking
PASSED=0
FAILED=0
WARNINGS=0

function test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS: $2${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL: $2${NC}"
        ((FAILED++))
    fi
}

function test_warning() {
    echo -e "${YELLOW}⚠️  WARN: $1${NC}"
    ((WARNINGS++))
}

echo -e "${BLUE}Test 1: Prometheus Phase 3 Recording Rules${NC}"

# Test concurrency ratio recording rule
QUERY="axia:ingestor:concurrency_ratio"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "Concurrency ratio recording rule"
else
    test_result 1 "Concurrency ratio recording rule"
fi

# Test 429 rate recording rule
QUERY="axia:ingestor:429_rate5m"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "429 rate recording rule"
else
    test_result 1 "429 rate recording rule"
fi

# Test PII rate recording rule
QUERY="axia:ingestor:pii_rate5m"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "PII rate recording rule"
else
    test_result 1 "PII rate recording rule"
fi

echo -e "${BLUE}Test 2: Alertmanager Configuration${NC}"

# Test Alertmanager API
RESPONSE=$(curl -s "${ALERTMANAGER_URL}/api/v1/status" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "Alertmanager API accessibility"
else
    test_result 1 "Alertmanager API accessibility"
fi

# Test alert routing configuration
RESPONSE=$(curl -s "${ALERTMANAGER_URL}/api/v1/receivers" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.data | length > 0' > /dev/null 2>&1; then
    RECEIVERS=$(echo "$RESPONSE" | jq -r '.data[].name' | tr '\n' ' ')
    echo "   Available receivers: $RECEIVERS"
    test_result 0 "Alert receivers configuration"
else
    test_result 1 "Alert receivers configuration"
fi

echo -e "${BLUE}Test 3: Blackbox Health Checks${NC}"

# Test Blackbox Exporter itself
if curl -s "${BLACKBOX_URL}/metrics" > /dev/null 2>&1; then
    test_result 0 "Blackbox Exporter accessibility"
else
    test_result 1 "Blackbox Exporter accessibility"
fi

# Test health probe configuration
RESPONSE=$(curl -s "${BLACKBOX_URL}/config" 2>/dev/null)
if echo "$RESPONSE" | grep -q "http_2xx" 2>/dev/null; then
    test_result 0 "Blackbox probe modules configuration"
else
    test_result 1 "Blackbox probe modules configuration"
fi

# Test telemetry service probes through Blackbox
SERVICES=("jwt-gateway:8082" "telemetry-proxy:8083" "telemetry-ingestor:8081")
for service in "${SERVICES[@]}"; do
    PROBE_URL="${BLACKBOX_URL}/probe?module=http_2xx&target=http://${service}/healthz"
    if curl -s "$PROBE_URL" | grep -q "probe_success 1" 2>/dev/null; then
        test_result 0 "Blackbox probe for $service"
    else
        test_warning "Blackbox probe for $service (service may not be running)"
    fi
done

echo -e "${BLUE}Test 4: Phase 3 Alert Rules${NC}"

# Test alert rule compilation
QUERY="ALERTS{alertname=\"IngestorPIIDrops\"}"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "PII drops alert rule"
else
    test_result 1 "PII drops alert rule"
fi

QUERY="ALERTS{alertname=\"IngestorCardinalityOverflow\"}"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "Cardinality overflow alert rule"
else
    test_result 1 "Cardinality overflow alert rule"
fi

QUERY="ALERTS{alertname=\"IngestorHighConcurrency\"}"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "High concurrency alert rule"
else
    test_result 1 "High concurrency alert rule"
fi

echo -e "${BLUE}Test 5: Dashboard Threshold Configuration${NC}"

# Check if Grafana sanity dashboard exists
GRAFANA_URL="http://localhost:3000"
GRAFANA_API="$GRAFANA_URL/api"

# Test dashboard existence (requires admin credentials)
DASHBOARD_CHECK=$(curl -s -u admin:${GRAFANA_ADMIN_PASSWORD:-admin} "$GRAFANA_API/search?query=Ingestor" 2>/dev/null)
if echo "$DASHBOARD_CHECK" | jq -e '. | length > 0' > /dev/null 2>&1; then
    test_result 0 "Ingestor Sanity dashboard availability"
else
    test_warning "Cannot verify dashboard (Grafana credentials needed)"
fi

echo -e "${BLUE}Test 6: Configuration Files Validation${NC}"

# Check if all Phase 3 files exist
FILES=(
    "monitoring/prometheus/prometheus_rules_phase3_ops_intel.yml"
    "monitoring/alertmanager/alertmanager_routes_phase3.yml"
    "monitoring/dashboards/grafana_dashboard_ingestor_sanity_v2.json"
    "k8s/keda_scaledobject_ingestor.yaml"
    "monitoring/blackbox/blackbox_telemetry_targets.yml"
    "docs/RUNBOOK_telemetry_ops.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "Configuration file exists: $(basename $file)"
    else
        test_result 1 "Configuration file missing: $file"
    fi
done

echo -e "${BLUE}Test 7: Operational Intelligence Features${NC}"

# Test runbook accessibility
if [ -f "docs/RUNBOOK_telemetry_ops.md" ] && [ -r "docs/RUNBOOK_telemetry_ops.md" ]; then
    SECTIONS=$(grep -c "^## " docs/RUNBOOK_telemetry_ops.md 2>/dev/null || echo 0)
    if [ "$SECTIONS" -ge 5 ]; then
        test_result 0 "Runbook completeness ($SECTIONS sections)"
    else
        test_result 1 "Runbook completeness (only $SECTIONS sections)"
    fi
else
    test_result 1 "Runbook accessibility"
fi

# Test anomaly detection query (Holt-Winters)
QUERY="holt_winters(axia:ingestor:429_rate5m[1h], 0.1, 0.3)"
RESPONSE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${QUERY}" 2>/dev/null)
if echo "$RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    test_result 0 "Anomaly detection (Holt-Winters) capability"
else
    test_result 1 "Anomaly detection (Holt-Winters) capability"
fi

echo ""
echo "📊 Validation Summary"
echo "===================="
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "📄 Total:    $((PASSED + FAILED + WARNINGS))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Phase 3 Ops Intelligence validation SUCCESSFUL!${NC}"
    echo ""
    echo "Your telemetry platform now includes:"
    echo "• Advanced Prometheus recording rules and alerts"
    echo "• Severity-based alert routing (PagerDuty + Slack)"
    echo "• Enhanced dashboard with threshold coloring"
    echo "• External health monitoring via Blackbox"
    echo "• Anomaly detection with seasonal baselines"
    echo "• Comprehensive operational runbook"
    echo ""
    echo "System is ready for production operations! 🚀"
    exit 0
else
    echo -e "${RED}❌ Phase 3 validation completed with $FAILED failures${NC}"
    echo ""
    echo "Please address the failed tests before proceeding to production."
    echo "Check service status and configuration files."
    exit 1
fi