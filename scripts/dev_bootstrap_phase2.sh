#!/bin/bash
# Development Bootstrap Script - Phase 2 Enhanced
# Comprehensive setup for JWT Gateway, Proxy, Ingestor, and monitoring stack

set -e

echo "🚀 Axia Telemetry Phase 2 - Development Bootstrap"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KEYS_DIR="./keys"
SECRETS_FILE=".env.dev"
COMPOSE_FILE="docker-compose.dev.yml"

echo -e "${BLUE}Step 1: Generating RSA key pair for JWT Gateway...${NC}"

# Create keys directory
mkdir -p $KEYS_DIR

# Generate RSA keys if they don't exist
if [ ! -f "$KEYS_DIR/private.pem" ]; then
    echo "Generating new RSA key pair..."
    
    # Generate private key
    openssl genpkey -algorithm RSA -out "$KEYS_DIR/private.pem" -pkcs8 -pass pass: 2048
    
    # Extract public key
    openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem" 2>/dev/null
    
    # Generate key metadata
    KEY_ID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "dev-key-$(date +%s)")
    cat > "$KEYS_DIR/metadata.json" << EOF
{
  "keyId": "$KEY_ID",
  "algorithm": "RS256",
  "keySize": 2048,
  "generated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rotationTime": $(date +%s)000
}
EOF
    
    echo -e "${GREEN}✅ RSA key pair generated${NC}"
    echo "   Private key: $KEYS_DIR/private.pem"
    echo "   Public key: $KEYS_DIR/public.pem"
    echo "   Key ID: $KEY_ID"
else
    echo -e "${YELLOW}⚠️  Using existing RSA key pair${NC}"
fi

echo -e "${BLUE}Step 2: Generating development secrets...${NC}"

# Generate secrets file if it doesn't exist
if [ ! -f "$SECRETS_FILE" ]; then
    echo "Creating development secrets file..."
    
    # Generate random secrets
    HMAC_SECRET=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    ADMIN_TOKEN=$(openssl rand -hex 16)
    GRAFANA_PASSWORD=$(openssl rand -base64 12 | tr -d '=+/')
    
    cat > "$SECRETS_FILE" << EOF
# Axia Telemetry Development Configuration
# Generated on $(date)

# Core Authentication
HMAC_SECRET=$HMAC_SECRET
JWT_SECRET=$JWT_SECRET
ADMIN_TOKEN=$ADMIN_TOKEN

# JWT Gateway Configuration
JWT_ISSUER=axia-telemetry-gateway
JWT_AUDIENCE=axia-telemetry
JWT_TTL=5m
KEY_ROTATION_HOURS=24

# Database Configuration
DATABASE_URL=postgresql://axia:axia@localhost:5432/axia_dev
PGHOST=localhost
PGPORT=5432
PGUSER=axia
PGPASSWORD=axia
PGDATABASE=axia_dev

# Monitoring
GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD

# Slack Integration (optional - set in production)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# External Services (optional)
# PROMETHEUS_URL=http://localhost:9090
# PUSHGATEWAY_URL=http://localhost:9091
EOF
    
    echo -e "${GREEN}✅ Development secrets generated: $SECRETS_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Using existing secrets file: $SECRETS_FILE${NC}"
fi

echo -e "${BLUE}Step 3: Installing Node.js dependencies...${NC}"

# Install JWT Gateway dependencies
if [ -d "services/jwt-gateway" ]; then
    echo "Installing JWT Gateway dependencies..."
    cd services/jwt-gateway
    npm install
    cd ../..
fi

# Install CLI dependencies
if [ -d "cli" ]; then
    echo "Installing CLI dependencies..."
    cd cli
    npm install
    cd ..
fi

# Install dashboard generator dependencies
echo "Installing dashboard generator dependencies..."
npm install commander date-fns node-fetch

echo -e "${GREEN}✅ Dependencies installed${NC}"

echo -e "${BLUE}Step 4: Testing JWT flow...${NC}"

# Start services in background for testing
if command -v docker-compose &> /dev/null; then
    echo "Starting development services..."
    docker-compose -f docker-compose.yml up -d --build
    
    # Wait for services to be ready
    echo "Waiting for services to start..."
    sleep 10
    
    # Test JWT Gateway
    echo "Testing JWT Gateway..."
    if curl -s http://localhost:8082/healthz > /dev/null; then
        echo -e "${GREEN}✅ JWT Gateway is healthy${NC}"
    else
        echo -e "${RED}❌ JWT Gateway failed to start${NC}"
    fi
    
    # Test JWKS endpoint
    echo "Testing JWKS endpoint..."
    if curl -s http://localhost:8082/.well-known/jwks.json | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}✅ JWKS endpoint is working${NC}"
    else
        echo -e "${YELLOW}⚠️  JWKS endpoint not accessible${NC}"
    fi
    
    # Test token minting
    if [ -f "cli/token-mint.js" ]; then
        echo "Testing token minting..."
        cd cli
        if node token-mint.js issue --project-id demo-test > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Token minting works${NC}"
        else
            echo -e "${YELLOW}⚠️  Token minting not ready${NC}"
        fi
        cd ..
    fi
else
    echo -e "${YELLOW}⚠️  Docker Compose not available, skipping service tests${NC}"
fi

echo -e "${BLUE}Step 5: Setting up monitoring dashboards...${NC}"

# Generate sample tenant dashboards
if [ -f "config/tenants.example.json" ] && [ -f "scripts/dashboard-generator.js" ]; then
    echo "Generating sample tenant dashboards..."
    mkdir -p monitoring/dashboards/generated
    
    cd scripts
    if node dashboard-generator.js generate \
        --templates ../monitoring/dashboards/axia-customer-drilldown-single-tenant.json \
        --tenants ../config/tenants.example.json \
        --out ../monitoring/dashboards/generated \
        --prometheus-uid prom-main > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Sample dashboards generated${NC}"
    else
        echo -e "${YELLOW}⚠️  Dashboard generation not ready${NC}"
    fi
    cd ..
fi

echo -e "${BLUE}Step 6: Creating handy scripts...${NC}"

# Create convenience scripts
cat > scripts/test-flow.sh << 'EOF'
#!/bin/bash
# Quick end-to-end flow test

echo "🧪 Testing complete JWT flow..."

# Request token
echo "1. Requesting JWT token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8082/v1/tlm/token \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test-project"}')

if [ $? -eq 0 ]; then
  TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')
  echo "   ✅ Token received"
else
  echo "   ❌ Token request failed"
  exit 1
fi

# Send telemetry
echo "2. Sending telemetry through proxy..."
TELEMETRY_RESPONSE=$(curl -s -X POST http://localhost:8083/v1/telemetry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "events": [{
      "project_id": "test-project",
      "method": "test",
      "platform": "cli",
      "outcome": "ok",
      "latency_ms": 100
    }]
  }')

if [ $? -eq 0 ]; then
  echo "   ✅ Telemetry sent successfully"
else
  echo "   ❌ Telemetry failed"
  exit 1
fi

echo "🎉 End-to-end test passed!"
EOF

chmod +x scripts/test-flow.sh

# Create load test script
cat > scripts/run-load-test.sh << 'EOF'
#!/bin/bash
# Run k6 load test

if ! command -v k6 &> /dev/null; then
  echo "k6 not installed. Install from https://k6.io/docs/getting-started/installation/"
  exit 1
fi

echo "🚀 Running k6 load test..."

k6 run \
  --env GATEWAY_URL=http://localhost:8082 \
  --env PROXY_URL=http://localhost:8083 \
  --env PROJECT_IDS=load-test-1,load-test-2 \
  --env SCENARIO=development \
  scripts/k6-telemetry-load-test.js
EOF

chmod +x scripts/run-load-test.sh

echo -e "${GREEN}✅ Convenience scripts created${NC}"

echo -e "${BLUE}Step 7: Bootstrap complete!${NC}"
echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "Available services:"
echo "  • JWT Gateway:        http://localhost:8082"
echo "  • Telemetry Proxy:    http://localhost:8083"
echo "  • Telemetry Ingestor: http://localhost:8081"
echo "  • Axia Server:        http://localhost:5000"
echo "  • Prometheus:         http://localhost:9090"
echo "  • Grafana:            http://localhost:3000 (admin:$GRAFANA_PASSWORD)"
echo ""
echo "Useful commands:"
echo "  • Test JWT flow:      ./scripts/test-flow.sh"
echo "  • Run load test:      ./scripts/run-load-test.sh"
echo "  • Mint JWT token:     cd cli && node token-mint.js issue --project-id demo"
echo "  • Generate dashboards: cd scripts && node dashboard-generator.js --help"
echo ""
echo "Configuration files:"
echo "  • Development secrets: $SECRETS_FILE"
echo "  • JWT keys:           $KEYS_DIR/"
echo "  • Tenant config:      config/tenants.example.json"
echo ""
echo -e "${GREEN}Happy developing! 🚀${NC}"