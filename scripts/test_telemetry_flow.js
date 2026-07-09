// scripts/test_telemetry_flow.js
// Test the complete JWT → HMAC telemetry flow
import fetch from 'node-fetch';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8082';
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8083';
const PROJECT_ID = process.env.PROJECT_ID || 'test-project';

async function testFlow() {
  console.log('🧪 Testing complete telemetry authentication flow...\n');

  // Step 1: Get JWT token from gateway
  console.log('1️⃣ Fetching JWT token from gateway...');
  const tokenRes = await fetch(`${GATEWAY_URL}/v1/tlm/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: PROJECT_ID })
  });
  
  if (!tokenRes.ok) {
    console.error('❌ Token fetch failed:', tokenRes.status);
    return;
  }
  
  const { token } = await tokenRes.json();
  console.log('✅ JWT token obtained:', token.substring(0, 50) + '...\n');

  // Step 2: Send telemetry through JWT → HMAC proxy
  console.log('2️⃣ Sending telemetry through JWT → HMAC proxy...');
  const telemetryData = {
    events: [
      {
        project_id: PROJECT_ID,
        method: 'status',
        client_version: '1.0.0',
        platform: 'chrome',
        outcome: 'ok',
        latency_ms: 150
      }
    ]
  };

  const proxyRes = await fetch(`${PROXY_URL}/v1/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(telemetryData)
  });

  if (!proxyRes.ok) {
    console.error('❌ Proxy request failed:', proxyRes.status);
    const text = await proxyRes.text();
    console.error('Response:', text);
    return;
  }

  const proxyResult = await proxyRes.json();
  console.log('✅ Telemetry sent successfully:', proxyResult);
  console.log('\n🎉 Complete telemetry flow working!');
}

testFlow().catch(console.error);