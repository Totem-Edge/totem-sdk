#!/bin/bash
# Phase 3 Ops Intelligence - Final Acceptance Checklist
# Comprehensive validation of all Phase 3 components

set -e

echo "🎯 Phase 3 Ops Intelligence - Final Acceptance Checklist"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
    echo -e "${YELLOW}⚠️  MANUAL: $1${NC}"
    ((WARNINGS++))
}

echo -e "${BLUE}📋 Checklist Item 1: Prometheus Rulesets${NC}"

# Check both ruleset files exist
if [ -f "monitoring/prometheus/prometheus_rules_phase3_ops_intel.yml" ]; then
    test_result 0 "Phase 3 Ops Intel rules file exists"
else
    test_result 1 "Phase 3 Ops Intel rules file missing"
fi

if [ -f "monitoring/prometheus/prometheus_rules_phase3_tenant_anomaly_forecast.yml" ]; then
    test_result 0 "Phase 3 Tenant Anomaly rules file exists"
else
    test_result 1 "Phase 3 Tenant Anomaly rules file missing"
fi

# Validate rule content
RECORDING_RULES=$(grep -c "^  - record:" monitoring/prometheus/prometheus_rules_phase3_ops_intel.yml 2>/dev/null || echo 0)
ALERT_RULES=$(grep -c "^  - alert:" monitoring/prometheus/prometheus_rules_phase3_ops_intel.yml 2>/dev/null || echo 0)

if [ "$RECORDING_RULES" -ge 6 ]; then
    test_result 0 "Ops Intel recording rules ($RECORDING_RULES found)"
else
    test_result 1 "Insufficient Ops Intel recording rules ($RECORDING_RULES found)"
fi

if [ "$ALERT_RULES" -ge 6 ]; then
    test_result 0 "Ops Intel alert rules ($ALERT_RULES found)"
else
    test_result 1 "Insufficient Ops Intel alert rules ($ALERT_RULES found)"
fi

TENANT_RULES=$(grep -c "^  - record:" monitoring/prometheus/prometheus_rules_phase3_tenant_anomaly_forecast.yml 2>/dev/null || echo 0)
TENANT_ALERTS=$(grep -c "^  - alert:" monitoring/prometheus/prometheus_rules_phase3_tenant_anomaly_forecast.yml 2>/dev/null || echo 0)

if [ "$TENANT_RULES" -ge 10 ]; then
    test_result 0 "Tenant anomaly recording rules ($TENANT_RULES found)"
else
    test_result 1 "Insufficient tenant anomaly recording rules ($TENANT_RULES found)"
fi

if [ "$TENANT_ALERTS" -ge 4 ]; then
    test_result 0 "Tenant anomaly alert rules ($TENANT_ALERTS found)"
else
    test_result 1 "Insufficient tenant anomaly alert rules ($TENANT_ALERTS found)"
fi

test_warning "Load rules into Prometheus and run: curl -X POST http://localhost:9090/-/reload"

echo -e "${BLUE}📋 Checklist Item 2: Alertmanager Routes${NC}"

if [ -f "monitoring/alertmanager/alertmanager_routes_phase3.yml" ]; then
    test_result 0 "Alertmanager routes file exists"
else
    test_result 1 "Alertmanager routes file missing"
fi

# Check routing configuration
PAGE_ROUTES=$(grep -c 'severity="page"' monitoring/alertmanager/alertmanager_routes_phase3.yml 2>/dev/null || echo 0)
WARN_ROUTES=$(grep -c 'severity="warn"' monitoring/alertmanager/alertmanager_routes_phase3.yml 2>/dev/null || echo 0)

if [ "$PAGE_ROUTES" -ge 2 ]; then
    test_result 0 "PAGE severity routing configured ($PAGE_ROUTES routes)"
else
    test_result 1 "PAGE severity routing missing ($PAGE_ROUTES routes)"
fi

if [ "$WARN_ROUTES" -ge 1 ]; then
    test_result 0 "WARN severity routing configured ($WARN_ROUTES routes)"
else
    test_result 1 "WARN severity routing missing ($WARN_ROUTES routes)"
fi

PAGERDUTY_CONFIG=$(grep -c "pagerduty_configs" monitoring/alertmanager/alertmanager_routes_phase3.yml 2>/dev/null || echo 0)
SLACK_CONFIG=$(grep -c "slack_configs" monitoring/alertmanager/alertmanager_routes_phase3.yml 2>/dev/null || echo 0)

if [ "$PAGERDUTY_CONFIG" -ge 1 ]; then
    test_result 0 "PagerDuty configuration found"
else
    test_result 1 "PagerDuty configuration missing"
fi

if [ "$SLACK_CONFIG" -ge 2 ]; then
    test_result 0 "Slack configurations found ($SLACK_CONFIG configs)"
else
    test_result 1 "Insufficient Slack configurations ($SLACK_CONFIG configs)"
fi

test_warning "Deploy Alertmanager config and test: Set PAGERDUTY_ROUTING_KEY and SLACK_WEBHOOK_URL"

echo -e "${BLUE}📋 Checklist Item 3: Enhanced Dashboards${NC}"

if [ -f "monitoring/dashboards/grafana_dashboard_ingestor_sanity_v2.json" ]; then
    test_result 0 "Ingestor Sanity v2 dashboard exists"
else
    test_result 1 "Ingestor Sanity v2 dashboard missing"
fi

if [ -f "monitoring/dashboards/grafana_dashboard_cost_forecast.json" ]; then
    test_result 0 "Cost Forecast dashboard exists"
else
    test_result 1 "Cost Forecast dashboard missing"
fi

if [ -f "monitoring/dashboards/grafana_dashboard_tenant_abuse_anomaly.json" ]; then
    test_result 0 "Tenant Abuse Anomaly dashboard exists"
else
    test_result 1 "Tenant Abuse Anomaly dashboard missing"
fi

# Check threshold coloring
THRESHOLDS=$(grep -c "thresholds" monitoring/dashboards/grafana_dashboard_ingestor_sanity_v2.json 2>/dev/null || echo 0)
if [ "$THRESHOLDS" -ge 10 ]; then
    test_result 0 "Threshold coloring configured ($THRESHOLDS thresholds)"
else
    test_result 1 "Insufficient threshold coloring ($THRESHOLDS thresholds)"
fi

COLOR_COUNT=$(grep -o '"color":\s*"[^"]*"' monitoring/dashboards/grafana_dashboard_ingestor_sanity_v2.json | sort | uniq | wc -l)
if [ "$COLOR_COUNT" -ge 3 ]; then
    test_result 0 "Color variety in thresholds ($COLOR_COUNT colors)"
else
    test_result 1 "Limited color variety in thresholds ($COLOR_COUNT colors)"
fi

test_warning "Import dashboards to Grafana and stamp Prometheus datasource UID"

echo -e "${BLUE}📋 Checklist Item 4: KEDA Autoscaling${NC}"

if [ -f "k8s/keda_scaledobject_ingestor.yaml" ]; then
    test_result 0 "KEDA ScaledObject manifest exists"
else
    test_result 1 "KEDA ScaledObject manifest missing"
fi

if [ -f "k8s/prometheus-auth-secret.yaml" ]; then
    test_result 0 "KEDA Prometheus auth secret exists"
else
    test_result 1 "KEDA Prometheus auth secret missing"
fi

# Check KEDA configuration
THRESHOLD=$(grep "threshold:" k8s/keda_scaledobject_ingestor.yaml | grep -o '"[0-9.]*"' | tr -d '"')
if [ "$THRESHOLD" = "0.6" ]; then
    test_result 0 "KEDA threshold set to 0.6 (60%)"
else
    test_result 1 "KEDA threshold incorrect: $THRESHOLD"
fi

MIN_REPLICAS=$(grep "minReplicaCount:" k8s/keda_scaledobject_ingestor.yaml | grep -o '[0-9]*')
MAX_REPLICAS=$(grep "maxReplicaCount:" k8s/keda_scaledobject_ingestor.yaml | grep -o '[0-9]*')

if [ "$MIN_REPLICAS" = "2" ] && [ "$MAX_REPLICAS" = "20" ]; then
    test_result 0 "KEDA replica range: $MIN_REPLICAS-$MAX_REPLICAS"
else
    test_result 1 "KEDA replica range incorrect: $MIN_REPLICAS-$MAX_REPLICAS"
fi

test_warning "Apply KEDA manifest: kubectl apply -f k8s/keda_scaledobject_ingestor.yaml"

echo -e "${BLUE}📋 Checklist Item 5: Blackbox Health Checks${NC}"

if [ -f "monitoring/blackbox/blackbox.yml" ]; then
    test_result 0 "Blackbox exporter config exists"
else
    test_result 1 "Blackbox exporter config missing"
fi

if [ -f "monitoring/blackbox/blackbox_telemetry_targets.yml" ]; then
    test_result 0 "Blackbox targets config exists"
else
    test_result 1 "Blackbox targets config missing"
fi

# Check health endpoints
HEALTH_ENDPOINTS=$(grep -c "healthz" monitoring/blackbox/blackbox_telemetry_targets.yml 2>/dev/null || echo 0)
if [ "$HEALTH_ENDPOINTS" -ge 3 ]; then
    test_result 0 "Health endpoints configured ($HEALTH_ENDPOINTS endpoints)"
else
    test_result 1 "Insufficient health endpoints ($HEALTH_ENDPOINTS endpoints)"
fi

# Check Prometheus blackbox job
BLACKBOX_JOBS=$(grep -c "job_name.*blackbox" monitoring/prometheus/prometheus_phase3.yml 2>/dev/null || echo 0)
if [ "$BLACKBOX_JOBS" -ge 3 ]; then
    test_result 0 "Blackbox Prometheus jobs ($BLACKBOX_JOBS jobs)"
else
    test_result 1 "Insufficient Blackbox Prometheus jobs ($BLACKBOX_JOBS jobs)"
fi

test_warning "Deploy Blackbox exporter and verify /probe endpoints return success=1"

echo -e "${BLUE}📋 Checklist Item 6: HMAC Rotation${NC}"

if [ -f "scripts/rotate_hmac_secrets.js" ]; then
    test_result 0 "HMAC rotation script exists"
else
    test_result 1 "HMAC rotation script missing"
fi

if [ -f ".github/workflows/rotate-hmac-secrets.yml" ]; then
    test_result 0 "HMAC rotation GitHub Action exists"
else
    test_result 1 "HMAC rotation GitHub Action missing"
fi

if [ -f "secrets.hmac.json" ]; then
    test_result 0 "HMAC secrets file exists"
else
    test_result 1 "HMAC secrets file missing"
fi

# Check script content
ROTATION_LOGIC=$(grep -c "randSecret\|current\|previous" scripts/rotate_hmac_secrets.js 2>/dev/null || echo 0)
if [ "$ROTATION_LOGIC" -ge 3 ]; then
    test_result 0 "HMAC rotation logic present"
else
    test_result 1 "HMAC rotation logic incomplete"
fi

test_warning "Run HMAC rotation: node scripts/rotate_hmac_secrets.js (set INGESTOR_ADMIN_TOKEN)"

echo -e "${BLUE}📋 Checklist Item 7: Daily Usage Export${NC}"

if [ -f "scripts/export_daily_usage.js" ]; then
    test_result 0 "Usage export script exists"
else
    test_result 1 "Usage export script missing"
fi

if [ -f ".github/workflows/export-daily-usage.yml" ]; then
    test_result 0 "Usage export GitHub Action exists"
else
    test_result 1 "Usage export GitHub Action missing"
fi

# Check Prometheus query
PROM_QUERY=$(grep -o "sum by.*increase.*axia_credits_consumed_total" scripts/export_daily_usage.js 2>/dev/null || echo "")
if [ -n "$PROM_QUERY" ]; then
    test_result 0 "Prometheus query for usage export found"
else
    test_result 1 "Prometheus query for usage export missing"
fi

# Check S3 support
S3_SUPPORT=$(grep -c "S3Client\|PutObjectCommand" scripts/export_daily_usage.js 2>/dev/null || echo 0)
if [ "$S3_SUPPORT" -ge 2 ]; then
    test_result 0 "S3 upload support present"
else
    test_result 1 "S3 upload support missing"
fi

test_warning "Run usage export: node scripts/export_daily_usage.js (set PROM_URL, AWS creds)"

echo -e "${BLUE}📋 Checklist Item 8: Grafana Annotations${NC}"

if [ -f "scripts/annotate_deploy.js" ]; then
    test_result 0 "Grafana annotation script exists"
else
    test_result 1 "Grafana annotation script missing"
fi

if [ -f ".github/workflows/grafana-annotate-deploy.yml" ]; then
    test_result 0 "Grafana annotation GitHub Action exists"
else
    test_result 1 "Grafana annotation GitHub Action missing"
fi

# Check Grafana API usage
GRAFANA_API=$(grep -c "api/annotations\|Bearer" scripts/annotate_deploy.js 2>/dev/null || echo 0)
if [ "$GRAFANA_API" -ge 2 ]; then
    test_result 0 "Grafana API integration present"
else
    test_result 1 "Grafana API integration incomplete"
fi

test_warning "Test annotation: TEXT='Test deploy' node scripts/annotate_deploy.js (set GRAFANA_URL, API_KEY)"

echo ""
echo "📊 Final Acceptance Summary"
echo "=========================="
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"  
echo -e "⚠️  Manual:   ${YELLOW}$WARNINGS${NC}"
echo -e "📄 Total:    $((PASSED + FAILED + WARNINGS))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Phase 3 Configuration Validation SUCCESSFUL!${NC}"
    echo ""
    echo "All Phase 3 components are properly configured:"
    echo "• Advanced Prometheus rules and alerts ✅"
    echo "• Severity-based Alertmanager routing ✅"
    echo "• Enhanced dashboards with threshold coloring ✅"
    echo "• KEDA autoscaling configuration ✅"
    echo "• Blackbox external health monitoring ✅"
    echo "• HMAC rotation automation ✅"
    echo "• Daily usage export with S3 ✅"
    echo "• Grafana deployment annotations ✅"
    echo ""
    echo -e "${YELLOW}⚠️  Manual deployment steps required:${NC}"
    echo "1. Load Prometheus rules and reload"
    echo "2. Configure Alertmanager with environment variables"
    echo "3. Import dashboards with stamped datasource UIDs"
    echo "4. Apply KEDA manifests to Kubernetes"
    echo "5. Deploy and test Blackbox health checks"
    echo "6. Test operational scripts with proper credentials"
    echo ""
    echo -e "${GREEN}Ready for production deployment! 🚀${NC}"
    exit 0
else
    echo -e "${RED}❌ Phase 3 validation completed with $FAILED configuration issues${NC}"
    echo ""
    echo "Please address the failed validations before production deployment."
    exit 1
fi