// k6 Load Testing Script for Axia Telemetry System
// Tests the complete JWT → Proxy → Ingestor flow with realistic patterns

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Histogram } from 'k6/metrics';

// Custom metrics
const authFailures = new Counter('auth_failures');
const tokenRequests = new Counter('token_requests');
const telemetryRequests = new Counter('telemetry_requests');
const endToEndLatency = new Histogram('end_to_end_latency');

// Configuration
const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:8082';
const PROXY_URL = __ENV.PROXY_URL || 'http://localhost:8083';
const PROJECT_IDS = (__ENV.PROJECT_IDS || 'load-test-1,load-test-2,load-test-3').split(',');

// Test scenarios
export const options = {
  scenarios: {
    // Constant load - simulates normal usage
    constant_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      tags: { scenario: 'constant' },
    },
    
    // Burst load - simulates traffic spikes
    burst_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up
        { duration: '1m', target: 50 },   // Stay high
        { duration: '30s', target: 0 },   // Ramp down
      ],
      tags: { scenario: 'burst' },
    },
    
    // Rate limiting test
    rate_limit_test: {
      executor: 'constant-arrival-rate',
      rate: 100,  // 100 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      tags: { scenario: 'rate_limit' },
    },
    
    // Concurrency stress test
    concurrency_test: {
      executor: 'constant-vus',
      vus: 100,
      duration: '1m',
      tags: { scenario: 'concurrency' },
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // Response time thresholds
    http_req_failed: ['rate<0.05'],                   // Error rate < 5%
    auth_failures: ['rate<0.01'],                     // Auth failure rate < 1%
    end_to_end_latency: ['p(95)<3000'],              // End-to-end latency
  }
};

// Test data generators
function generateTelemetryEvent(projectId) {
  const methods = ['status', 'balance', 'send', 'history', 'connect'];
  const platforms = ['chrome', 'firefox', 'safari', 'edge'];
  const regions = ['us-east', 'us-west', 'eu-west', 'eu-central', 'ap-south'];
  const outcomes = ['ok', 'error'];
  const errorClasses = ['client', 'server', 'upstream', 'rate_limit', 'validation'];
  
  const outcome = Math.random() < 0.95 ? 'ok' : 'error'; // 95% success rate
  
  const event = {
    project_id: projectId,
    method: methods[Math.floor(Math.random() * methods.length)],
    client_version: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
    platform: platforms[Math.floor(Math.random() * platforms.length)],
    region: regions[Math.floor(Math.random() * regions.length)],
    latency_ms: Math.floor(Math.random() * 1000) + 50,
    outcome
  };
  
  // Add error details for failed requests
  if (outcome === 'error') {
    event.error_class = errorClasses[Math.floor(Math.random() * errorClasses.length)];
  }
  
  // Add retry information occasionally
  if (Math.random() < 0.1) {
    event.retry = {
      reason: ['429', '5xx', 'network', 'timeout'][Math.floor(Math.random() * 4)],
      count: Math.floor(Math.random() * 3) + 1
    };
  }
  
  // Add credit information
  if (Math.random() < 0.8) {
    event.credits = {
      unit: 'request',
      amount: 1,
      plan_tier: ['free', 'pro', 'enterprise'][Math.floor(Math.random() * 3)]
    };
  }
  
  return event;
}

function generateBatch(projectId, size = 1) {
  const events = [];
  for (let i = 0; i < size; i++) {
    events.push(generateTelemetryEvent(projectId));
  }
  return { events };
}

// Token cache to reduce auth overhead
let tokenCache = new Map();

function getToken(projectId) {
  const cached = tokenCache.get(projectId);
  if (cached && cached.expires > Date.now()) {
    return cached.token;
  }
  
  const response = http.post(`${GATEWAY_URL}/v1/tlm/token`, JSON.stringify({
    project_id: projectId
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation: 'auth', project_id: projectId }
  });
  
  tokenRequests.add(1);
  
  if (response.status !== 200) {
    authFailures.add(1);
    console.error(`Auth failed for ${projectId}: ${response.status} ${response.body}`);
    return null;
  }
  
  const data = response.json();
  const token = data.token;
  const expiresAt = Date.now() + (data.expires_in * 1000) - 10000; // 10s buffer
  
  tokenCache.set(projectId, { token, expires: expiresAt });
  return token;
}

export default function() {
  const projectId = PROJECT_IDS[Math.floor(Math.random() * PROJECT_IDS.length)];
  const scenario = __ENV.SCENARIO || 'mixed';
  
  // Get authentication token
  const token = getToken(projectId);
  if (!token) {
    return; // Skip this iteration if auth failed
  }
  
  // Determine batch size based on scenario
  let batchSize = 1;
  if (scenario === 'burst' || __VU % 3 === 0) {
    batchSize = Math.floor(Math.random() * 5) + 1; // 1-5 events
  }
  
  // Generate telemetry payload
  const payload = generateBatch(projectId, batchSize);
  
  // Add sampling header occasionally
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  if (Math.random() < 0.1) {
    headers['X-Axia-Sample'] = (Math.random() * 0.5 + 0.3).toFixed(2); // 0.3-0.8
  }
  
  // Send telemetry request
  const startTime = Date.now();
  const response = http.post(`${PROXY_URL}/v1/telemetry`, JSON.stringify(payload), {
    headers,
    tags: { 
      operation: 'telemetry', 
      project_id: projectId, 
      batch_size: batchSize,
      scenario: __ENV.SCENARIO || 'default'
    }
  });
  
  const latency = Date.now() - startTime;
  endToEndLatency.add(latency);
  telemetryRequests.add(1);
  
  // Verify response
  const success = check(response, {
    'telemetry status is 202': (r) => r.status === 202,
    'telemetry response has ok field': (r) => {
      try {
        return r.json().ok === true;
      } catch {
        return false;
      }
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers['Retry-After'];
    if (retryAfter) {
      const waitTime = parseInt(retryAfter) * 1000;
      console.log(`Rate limited, waiting ${waitTime}ms`);
      sleep(waitTime / 1000);
    }
  }
  
  // Handle backpressure
  if (response.status === 503) {
    const retryAfter = response.headers['Retry-After'] || '1';
    const waitTime = parseInt(retryAfter) * 1000;
    sleep(waitTime / 1000);
  }
  
  // Realistic think time
  const thinkTime = Math.random() * 2 + 0.5; // 0.5-2.5 seconds
  sleep(thinkTime);
}

// Setup function - runs once at the start
export function setup() {
  console.log('Starting Axia Telemetry Load Test');
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log(`Proxy: ${PROXY_URL}`);
  console.log(`Project IDs: ${PROJECT_IDS.join(', ')}`);
  
  // Verify endpoints are accessible
  const gatewayHealth = http.get(`${GATEWAY_URL}/healthz`);
  const proxyHealth = http.get(`${PROXY_URL}/healthz`);
  
  if (gatewayHealth.status !== 200) {
    throw new Error(`Gateway health check failed: ${gatewayHealth.status}`);
  }
  
  if (proxyHealth.status !== 200) {
    throw new Error(`Proxy health check failed: ${proxyHealth.status}`);
  }
  
  console.log('✅ All endpoints healthy, starting load test');
  return {};
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total token requests: ${tokenRequests.count}`);
  console.log(`Total telemetry requests: ${telemetryRequests.count}`);
  console.log(`Auth failures: ${authFailures.count}`);
}