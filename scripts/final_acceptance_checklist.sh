#!/bin/bash
# Final Acceptance Checklist for Phases 1–3
# Enterprise Telemetry Platform - Production Readiness Validation
# An engineer/on-call can walk through this and mark ✅ / ❌

set -e

echo "🎯 Final Acceptance Checklist - Phases 1–3"
echo "=========================================="
echo "Enterprise Telemetry Platform Production Readiness"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Test results tracking
PHASE1_PASS=0
PHASE1_FAIL=0
PHASE2_PASS=0
PHASE2_FAIL=0
PHASE3_PASS=0
PHASE3_FAIL=0
FINAL_PASS=0
FINAL_FAIL=0

function check_item() {
    local description="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo -e "${BLUE}□ $description${NC}"
    
    if [ -n "$test_command" ]; then
        echo "   Test: $test_command"
        if [ -n "$expected_result" ]; then
            echo "   Expected: $expected_result"
        fi
    fi
    
    echo -n "   Manual verification: [y/n/s(skip)]: "
    read -r response
    
    case $response in
        y|Y)
            echo -e "   ${GREEN}✅ PASS${NC}"
            return 0
            ;;
        n|N)
            echo -e "   ${RED}❌ FAIL${NC}"
            return 1
            ;;
        s|S)
            echo -e "   ${YELLOW}⏭️  SKIP${NC}"
            return 2
            ;;
        *)
            echo -e "   ${YELLOW}⏭️  SKIP (invalid input)${NC}"
            return 2
            ;;
    esac
}

function phase_header() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

function section_header() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo ""
}

# PHASE 1 — FOUNDATION & DASHBOARDS
phase_header "PHASE 1 — FOUNDATION & DASHBOARDS"

section_header "Instrumentation & Metrics"

if check_item "project_id labels everywhere: HTTP/RPC, rate limiter, idempotency, quotas" \
    "count by (project_id) (axia_rpc_requests_total)" \
    "Non-zero results with project_id labels"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Rate limiter events emitted: allow/deny, Retry-After" \
    "increase(axia_rate_limit_denied_total[15m])" \
    "Metric exists and shows deny events"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Idempotency: hits/misses/collisions counters in place" \
    "sum by (project_id)(increase(axia_idem_collisions_total[1h]))" \
    "Idempotency metrics available"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Credits/Quota: axia_credits_consumed_total + axia_quota_limit available" \
    "axia_credits_consumed_total and axia_quota_limit{window=\"24h\"}" \
    "Both metrics present with proper labels"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

section_header "Tests (local CI)"

if check_item "Unit tests: Totem provider retries, idempotency, rate-limit headers, crypto" \
    "npm test" \
    "All unit tests pass (green)"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Postman: 200/429/5xx mock server + Mock Chaos + idempotency" \
    "Postman collection run" \
    "All assertions pass, chaos testing works"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Sanity checker on dashboards: Prom DS UID and \$project_id resolved" \
    "Dashboard validation script" \
    "All tenant dashboards have proper datasource UIDs"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

section_header "Dashboards & Routing"

if check_item "Project Drilldown (internal) renders with data; top-N tables populated" \
    "Grafana dashboard check" \
    "Dashboard loads with real data and tables"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Regional Status renders with region filters" \
    "Grafana regional dashboard" \
    "Region filtering works correctly"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Customer board (single-tenant) provisioned per tenant; no cross-tenant visibility" \
    "Tenant dashboard isolation check" \
    "Each tenant sees only their data"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Prometheus Blackbox scraping https://rpc.axia.to/v1/totem-shared is green" \
    "Blackbox probe check" \
    "probe_success = 1 for production endpoint"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

if check_item "Alert routes wired (PagerDuty/Slack) with labels per severity" \
    "Test alert firing" \
    "Alerts reach correct PagerDuty/Slack channels"; then
    ((PHASE1_PASS++))
else
    ((PHASE1_FAIL++))
fi

# PHASE 2 — CLIENT TELEMETRY, SECURITY & AUTOMATION
phase_header "PHASE 2 — CLIENT TELEMETRY, SECURITY & AUTOMATION"

section_header "JWT→HMAC Auth Path"

if check_item "Gateway JWT issuer live: /v1/tlm/token issues RS256 short-lived JWT" \
    "curl /v1/tlm/token and /.well-known/jwks.json" \
    "Returns valid JWT token and JWKS key"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "JWT→HMAC proxy verifies JWT and forwards with X-Axia-* HMAC headers" \
    "Proxy test with good/bad tokens" \
    "Rejects bad tokens, forwards good ones with HMAC"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "Ingestor (HMAC) verifies signature + timestamp skew and exposes metrics" \
    "HMAC verification test" \
    "Ingestor accepts valid HMAC, exposes telemetry metrics"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

section_header "Privacy & Guardrails"

if check_item "DPIA-lite reviewed: only technical telemetry, no PII" \
    "DPIA document review" \
    "Privacy assessment completed and stored"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "PII & forbidden-key drops enforced (emails, ETH addrs, etc.)" \
    "increase(axia_tlm_pii_drop_total[1h]) == 0" \
    "Zero PII drops during normal operations"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "Cardinality caps in place with overflow metric" \
    "increase(axia_tlm_cardinality_overflow_total[1h]) == 0" \
    "Zero cardinality overflows during normal ops"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

section_header "Backpressure & Sampling"

if check_item "Rate-limit & concurrency working: token bucket + 503 busy gate" \
    "axia_tlm_concurrency_in_flight, increase(axia_tlm_rate_limit_denied_total[15m])" \
    "Concurrency metric present, rate limiting working"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "Sampling: default + per-method/per-project + X-Axia-Sample honored" \
    "increase(axia_tlm_sampled_drop_total[15m])" \
    "Sampling responds to headers and configuration"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

section_header "Automation"

if check_item "Nightly k6 load runs and pushes summary to Pushgateway" \
    "GitHub Actions k6 workflow" \
    "Load tests run nightly and push metrics"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "Nightly Slack report posts failure rate, p95, RPS from Pushgateway" \
    "Slack KPI reporting workflow" \
    "Daily reports appear in Slack with metrics"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "Dev bootstrap brings up gateway/proxy/ingestor; curl demo succeeds" \
    "./dev_bootstrap.sh && curl demo" \
    "End-to-end demo works, axia_client_requests_total increments"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

section_header "Dashboards & Alerts"

if check_item "Ingestor /metrics Sanity dashboard imported with limiter/concurrency row" \
    "Grafana Ingestor Sanity dashboard" \
    "Dashboard shows rate limiter and concurrency panels"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

if check_item "Grafana alert rules for PII & cardinality spikes provisioned" \
    "Test alert thresholds" \
    "Alerts fire for PII/cardinality spikes (page/warn)"; then
    ((PHASE2_PASS++))
else
    ((PHASE2_FAIL++))
fi

# PHASE 3 — OPS INTELLIGENCE, FORECASTING & HYGIENE
phase_header "PHASE 3 — OPS INTELLIGENCE, FORECASTING & HYGIENE"

section_header "Intelligence & Forecasting"

if check_item "Per-tenant anomaly rules (z-scores) recording and alerting" \
    "axia:tenant:retry_zscore, axia:tenant:credits_zscore" \
    "Z-score metrics available and alerts fire (warn/page)"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Quota forecast: projected 24h vs limit alerts (90% warn, 110% page)" \
    "axia:tenant:quota_ratio_projected" \
    "Forecast alerts fire with synthetic load at thresholds"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

section_header "Dashboards"

if check_item "Tenant Abuse & Anomaly dashboard shows top z-scores and tenant drill" \
    "Grafana Tenant Abuse dashboard" \
    "Dashboard shows anomaly detection and tenant drilldown"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Cost & Quota Forecast dashboard shows projected ratios" \
    "Grafana Cost Forecast dashboard" \
    "Dashboard shows projected usage vs quota"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Sanity v2 thresholds color correctly (429/503/PII/ratio)" \
    "Grafana Sanity v2 dashboard" \
    "Threshold coloring works (green/orange/red)"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

section_header "Autoscaling & Health"

if check_item "KEDA ScaledObject applied; replicas increase when concurrency_ratio > threshold" \
    "kubectl get scaledobject, watch pod scaling" \
    "Autoscaling triggers at 60% concurrency ratio"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Blackbox probes for gateway/proxy/ingestor /healthz are green" \
    "Blackbox probe results" \
    "All health checks return probe_success=1"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

section_header "Ops Hygiene"

if check_item "Weekly HMAC rotation Action rotates secrets, calls reload, Slack notifies" \
    "GitHub Actions HMAC rotation workflow" \
    "Dry run: rotation succeeds, ingestor accepts previous+current"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Daily usage export writes CSV, uploads to S3, stores CI artifact" \
    "GitHub Actions usage export workflow" \
    "CSV generated, S3 upload works, artifact stored"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Grafana deployment annotations appear on dashboards on main pushes" \
    "GitHub Actions annotation workflow" \
    "Annotations visible in Grafana after deployments"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Promtail→Loki shipping Fastify logs; log labels present; queries work" \
    "Loki log query interface" \
    "Logs visible with level/service labels, queries functional"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

section_header "Runbooks & Routes"

if check_item "Incident runbook accessible and referenced by alert descriptions" \
    "Alert description links check" \
    "Runbook linked from alerts and accessible to on-call"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

if check_item "Alertmanager routes (severity=page/warn) reach correct destinations" \
    "Test alert routing" \
    "PAGE alerts → PagerDuty+Slack, WARN → Slack only"; then
    ((PHASE3_PASS++))
else
    ((PHASE3_FAIL++))
fi

# FINAL GO-LIVE GATE
phase_header "FINAL GO-LIVE GATE"

section_header "Security"

if check_item "JWT TTL ≤ 5m; HMAC secrets rotation tested; ingestor skew ≤ 5m" \
    "JWT expiry check, HMAC rotation test, timestamp validation" \
    "Security parameters within acceptable limits"; then
    ((FINAL_PASS++))
else
    ((FINAL_FAIL++))
fi

if check_item "Auth fails page/warn appropriately" \
    "Authentication failure alert test" \
    "Auth failures trigger appropriate alerts"; then
    ((FINAL_PASS++))
else
    ((FINAL_FAIL++))
fi

section_header "Privacy"

if check_item "PII drops zero in steady state; DPIA stored; dashboards customer-safe" \
    "PII monitoring, DPIA verification, dashboard isolation" \
    "No PII leaks, privacy compliant, single-tenant dashboards"; then
    ((FINAL_PASS++))
else
    ((FINAL_FAIL++))
fi

section_header "Reliability"

if check_item "k6 nightly stable (p95 & fail rate within SLO); autoscaling under load" \
    "k6 load test results, autoscaling verification" \
    "Performance within SLO, scaling responsive"; then
    ((FINAL_PASS++))
else
    ((FINAL_FAIL++))
fi

section_header "Observability"

if check_item "All dashboards render; UIDs stamped; alerts page/warn; Blackbox green" \
    "Dashboard functionality, alert routing, health checks" \
    "Complete observability stack operational"; then
    ((FINAL_PASS++))
else
    ((FINAL_FAIL++))
fi

section_header "Operations"

if check_item "Runbooks linked; export job lands CSV/S3; PD/Slack ack flow confirmed" \
    "Operational procedures verification" \
    "Complete operational readiness confirmed"; then
    ((FINAL_PASS++))
else
    ((FINAL_FAIL++))
fi

# FINAL SUMMARY
echo ""
echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}FINAL ACCEPTANCE SUMMARY${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Phase 1 — Foundation & Dashboards:${NC}"
echo -e "  ✅ Passed: ${GREEN}$PHASE1_PASS${NC}"
echo -e "  ❌ Failed: ${RED}$PHASE1_FAIL${NC}"
echo ""

echo -e "${BLUE}Phase 2 — Client Telemetry, Security & Automation:${NC}"
echo -e "  ✅ Passed: ${GREEN}$PHASE2_PASS${NC}"
echo -e "  ❌ Failed: ${RED}$PHASE2_FAIL${NC}"
echo ""

echo -e "${BLUE}Phase 3 — Ops Intelligence, Forecasting & Hygiene:${NC}"
echo -e "  ✅ Passed: ${GREEN}$PHASE3_PASS${NC}"
echo -e "  ❌ Failed: ${RED}$PHASE3_FAIL${NC}"
echo ""

echo -e "${BLUE}Final Go-Live Gate:${NC}"
echo -e "  ✅ Passed: ${GREEN}$FINAL_PASS${NC}"
echo -e "  ❌ Failed: ${RED}$FINAL_FAIL${NC}"
echo ""

TOTAL_PASS=$((PHASE1_PASS + PHASE2_PASS + PHASE3_PASS + FINAL_PASS))
TOTAL_FAIL=$((PHASE1_FAIL + PHASE2_FAIL + PHASE3_FAIL + FINAL_FAIL))
TOTAL_ITEMS=$((TOTAL_PASS + TOTAL_FAIL))

echo -e "${BLUE}OVERALL RESULTS:${NC}"
echo -e "  📊 Total Items: $TOTAL_ITEMS"
echo -e "  ✅ Total Passed: ${GREEN}$TOTAL_PASS${NC}"
echo -e "  ❌ Total Failed: ${RED}$TOTAL_FAIL${NC}"

if [ $TOTAL_FAIL -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 PRODUCTION READY! 🎉${NC}"
    echo -e "${GREEN}All acceptance criteria met. System ready for go-live.${NC}"
    echo ""
    echo -e "${BLUE}✨ Enterprise Telemetry Platform Status: ${GREEN}APPROVED FOR PRODUCTION${NC} ✨"
    exit 0
else
    echo ""
    echo -e "${RED}❌ PRODUCTION READINESS: BLOCKED${NC}"
    echo -e "${RED}$TOTAL_FAIL item(s) failed validation.${NC}"
    echo ""
    echo -e "${YELLOW}Please address all failed items before production deployment.${NC}"
    exit 1
fi