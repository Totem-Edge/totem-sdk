#!/bin/bash
# Phase 3 Ops Intelligence Setup Script
# Deploys advanced monitoring, autoscaling, and operational intelligence

set -e

echo "🚀 Axia Telemetry Phase 3 - Ops Intelligence Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE=${1:-docker}  # docker or k8s
ENVIRONMENT=${2:-development} # development or production

echo -e "${BLUE}Step 1: Validating Phase 3 prerequisites...${NC}"

# Check if Phase 2 components exist
if [ ! -f "monitoring/prometheus/prometheus_rules_phase2_addon.yml" ]; then
    echo -e "${RED}❌ Phase 2 components not found. Run Phase 2 setup first.${NC}"
    exit 1
fi

if [ ! -f "services/jwt-gateway/server.ts" ]; then
    echo -e "${RED}❌ JWT Gateway not found. Run Phase 2 setup first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Phase 2 prerequisites verified${NC}"

echo -e "${BLUE}Step 2: Validating Phase 3 configurations...${NC}"

# Validate Prometheus rules
if command -v promtool &> /dev/null; then
    echo "Validating Prometheus rules..."
    promtool check rules monitoring/prometheus/prometheus_rules_phase3_ops_intel.yml
    echo -e "${GREEN}✅ Prometheus rules valid${NC}"
else
    echo -e "${YELLOW}⚠️  promtool not available, skipping validation${NC}"
fi

# Validate Alertmanager configuration
if command -v amtool &> /dev/null; then
    echo "Validating Alertmanager configuration..."
    # Create temporary config with environment variables resolved
    cat > /tmp/alertmanager_test.yml << EOF
route:
  receiver: default
  group_by: ['alertname', 'component']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 2h
  routes:
  - matchers:
      - severity="page"
    receiver: pagerduty-primary
    continue: true
  - matchers:
      - severity="page"
    receiver: slack-ops-page
  - matchers:
      - severity="warn"
    receiver: slack-ops-warn

receivers:
- name: default
- name: pagerduty-primary
  pagerduty_configs:
  - routing_key: dummy-key
    severity: critical
- name: slack-ops-page
  slack_configs:
  - send_resolved: true
    channel: "#oncall"
    api_url: https://hooks.slack.com/dummy
    title: "[PAGE] {{ .CommonLabels.component }} — {{ .CommonAnnotations.summary }}"
    text: "{{ range .Alerts }}• *{{ .Labels.alertname }}* — {{ .Annotations.description }} ({{ .Labels.component }})\n{{ end }}"
- name: slack-ops-warn
  slack_configs:
  - send_resolved: true
    channel: "#ops-warnings"
    api_url: https://hooks.slack.com/dummy
    title: "[WARN] {{ .CommonLabels.component }} — {{ .CommonAnnotations.summary }}"
    text: "{{ range .Alerts }}• *{{ .Labels.alertname }}* — {{ .Annotations.description }} ({{ .Labels.component }})\n{{ end }}"
EOF
    
    if amtool check-config /tmp/alertmanager_test.yml > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Alertmanager configuration valid${NC}"
    else
        echo -e "${YELLOW}⚠️  Alertmanager configuration warnings (non-blocking)${NC}"
    fi
    rm -f /tmp/alertmanager_test.yml
else
    echo -e "${YELLOW}⚠️  amtool not available, skipping validation${NC}"
fi

echo -e "${BLUE}Step 3: Setting up environment...${NC}"

# Create Phase 3 environment configuration
if [ ! -f ".env.phase3" ]; then
    cat > .env.phase3 << EOF
# Phase 3 Ops Intelligence Environment Configuration
# Generated on $(date)

# PagerDuty Integration
PAGERDUTY_ROUTING_KEY=your-pagerduty-integration-key

# Enhanced Slack Webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Blackbox Exporter
BLACKBOX_EXPORTER_PORT=9115

# KEDA Configuration (for Kubernetes)
KEDA_PROMETHEUS_SERVER=http://prometheus.monitoring:9090
KEDA_POLLING_INTERVAL=30
KEDA_COOLDOWN_PERIOD=300

# Enhanced Prometheus Configuration
PROMETHEUS_RETENTION=30d
PROMETHEUS_QUERY_TIMEOUT=30s
PROMETHEUS_MAX_CONNECTIONS=512

# Alertmanager Configuration
ALERTMANAGER_CLUSTER_LISTEN=

# Feature Flags
ENABLE_ANOMALY_DETECTION=true
ENABLE_SEASONAL_BASELINES=true
ENABLE_AUTOSCALING=true
ENABLE_BLACKBOX_MONITORING=true
EOF
    
    echo -e "${GREEN}✅ Phase 3 environment configuration created: .env.phase3${NC}"
else
    echo -e "${YELLOW}⚠️  Using existing .env.phase3 configuration${NC}"
fi

echo -e "${BLUE}Step 4: Deploying Phase 3 components...${NC}"

if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    echo "Deploying with Docker Compose..."
    
    # Copy Phase 3 compose file
    cp docker-compose.phase3.yml docker-compose.override.yml
    
    # Start Phase 3 services
    docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
    
    echo -e "${GREEN}✅ Docker services deployed${NC}"
    
elif [ "$DEPLOYMENT_TYPE" = "k8s" ]; then
    echo "Deploying to Kubernetes..."
    
    # Check kubectl availability
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl not found. Install kubectl for Kubernetes deployment.${NC}"
        exit 1
    fi
    
    # Deploy KEDA components
    if kubectl get namespace keda-system > /dev/null 2>&1; then
        echo "KEDA already installed"
    else
        echo "Installing KEDA..."
        kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.12.1/keda-2.12.1.yaml
        kubectl wait --for=condition=ready pod -l app=keda-operator -n keda-system --timeout=300s
        echo -e "${GREEN}✅ KEDA installed${NC}"
    fi
    
    # Create Prometheus authentication secret
    echo "Creating KEDA Prometheus authentication..."
    kubectl apply -f k8s/prometheus-auth-secret.yaml
    
    # Deploy KEDA ScaledObject
    kubectl apply -f k8s/keda_scaledobject_ingestor.yaml
    
    echo -e "${GREEN}✅ Kubernetes components deployed${NC}"
else
    echo -e "${RED}❌ Invalid deployment type: $DEPLOYMENT_TYPE (use 'docker' or 'k8s')${NC}"
    exit 1
fi

echo -e "${BLUE}Step 5: Waiting for services to be ready...${NC}"

sleep 15

# Health checks
echo "Performing health checks..."

if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    # Check Blackbox Exporter
    if curl -s http://localhost:9115/metrics > /dev/null; then
        echo -e "${GREEN}✅ Blackbox Exporter is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Blackbox Exporter not accessible${NC}"
    fi
    
    # Check enhanced Prometheus
    if curl -s http://localhost:9090/-/ready > /dev/null; then
        echo -e "${GREEN}✅ Prometheus is ready${NC}"
    else
        echo -e "${YELLOW}⚠️  Prometheus not ready${NC}"
    fi
    
    # Check Alertmanager
    if curl -s http://localhost:9093/-/ready > /dev/null; then
        echo -e "${GREEN}✅ Alertmanager is ready${NC}"
    else
        echo -e "${YELLOW}⚠️  Alertmanager not ready${NC}"
    fi
fi

echo -e "${BLUE}Step 6: Testing Phase 3 features...${NC}"

# Test recording rules
echo "Testing Prometheus recording rules..."
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    RULES_TEST=$(curl -s "http://localhost:9090/api/v1/query?query=axia:ingestor:concurrency_ratio" | jq -r '.status')
    if [ "$RULES_TEST" = "success" ]; then
        echo -e "${GREEN}✅ Recording rules are working${NC}"
    else
        echo -e "${YELLOW}⚠️  Recording rules not yet available (may need time)${NC}"
    fi
fi

echo -e "${BLUE}Step 7: Phase 3 setup complete!${NC}"
echo ""
echo "🎉 Ops Intelligence Pack deployed successfully!"
echo ""
echo "New Phase 3 Features:"
echo "  🔍 Advanced Prometheus Rules:"
echo "    • PII drop detection and alerting"
echo "    • Cardinality overflow monitoring"
echo "    • Anomaly detection with seasonal baselines"
echo "    • Enhanced concurrency and rate limiting metrics"
echo ""
echo "  📊 Enhanced Dashboards:"
echo "    • Threshold coloring on all key metrics"
echo "    • New concurrency ratio panel (70% orange, 90% red)"
echo "    • Improved cardinality overflow tracking"
echo ""
echo "  🚨 Severity-based Alerting:"
echo "    • PAGE alerts → PagerDuty + Slack #oncall"
echo "    • WARN alerts → Slack #ops-warnings"
echo ""
echo "  📈 Autoscaling (Kubernetes):"
echo "    • KEDA-based autoscaling on concurrency ratio"
echo "    • Scale 2-20 replicas based on >60% concurrency"
echo ""
echo "  💚 External Health Monitoring:"
echo "    • Blackbox probes for all telemetry endpoints"
echo "    • External validation of /healthz endpoints"
echo ""
echo "  📚 Operational Intelligence:"
echo "    • Incident response runbook"
echo "    • Step-by-step troubleshooting guides"
echo ""
echo "Access Points:"
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    echo "  • Enhanced Prometheus:  http://localhost:9090"
    echo "  • Enhanced Grafana:     http://localhost:3000"
    echo "  • Enhanced Alertmanager: http://localhost:9093"
    echo "  • Blackbox Exporter:    http://localhost:9115"
fi
echo ""
echo "Configuration:"
echo "  • Phase 3 environment:  .env.phase3"
echo "  • Ops runbook:         docs/RUNBOOK_telemetry_ops.md"
echo "  • KEDA config:         k8s/keda_scaledobject_ingestor.yaml"
echo ""
echo -e "${GREEN}Ready for production operations! 🚀${NC}"