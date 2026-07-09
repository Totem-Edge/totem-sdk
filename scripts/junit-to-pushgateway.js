#!/usr/bin/env node

/**
 * Convert JUnit test results to Prometheus metrics and push to Pushgateway
 * Usage: node scripts/junit-to-pushgateway.js ./junit.xml http://pushgateway:9091 "job=ci_tests,repo=x,sha=y"
 *
 * This script is best-effort: network failures exit 0 so the CI job is never
 * failed by a metrics upload problem. Test results are the real gate.
 */

import fs from 'fs';
import xml2js from 'xml2js';
// Using Node.js built-in fetch (Node 20+)

const [,, junitPath, pushUrl, jobLabels] = process.argv;

if (!junitPath || !pushUrl) {
  console.error('Usage: node scripts/junit-to-pushgateway.js ./junit.xml http://pushgateway:9091 "job=ci_tests,repo=x,sha=y"');
  process.exit(1);
}

// Detect localhost / missing URL so we can skip early rather than hang.
const isLocalhost = pushUrl.includes('localhost') || pushUrl.includes('127.0.0.1');

console.log(`📊 Converting JUnit results from ${junitPath} to Prometheus metrics`);

async function convertAndPush() {
  // Check if file exists
  if (!fs.existsSync(junitPath)) {
    console.warn(`⚠️  JUnit file not found: ${junitPath} — skipping metrics push`);
    process.exit(0);
  }

  // Parse XML
  let result;
  try {
    const xml = fs.readFileSync(junitPath, 'utf-8');
    const parser = new xml2js.Parser();
    result = await parser.parseStringPromise(xml);
  } catch (parseErr) {
    console.warn(`⚠️  Failed to parse JUnit XML: ${parseErr.message} — skipping metrics push`);
    process.exit(0);
  }

  const suites = result.testsuites?.testsuite || [];
  let totalTests = 0, totalFailures = 0, totalErrors = 0, totalSkipped = 0, totalTime = 0;

  for (const suite of suites) {
    const tests = parseInt(suite.$.tests || '0');
    const failures = parseInt(suite.$.failures || '0');
    const errors = parseInt(suite.$.errors || '0');
    const skipped = parseInt(suite.$.skipped || '0');
    const time = parseFloat(suite.$.time || '0');

    totalTests += tests;
    totalFailures += failures;
    totalErrors += errors;
    totalSkipped += skipped;
    totalTime += time;

    console.log(`📋 Suite: ${suite.$.name} - Tests: ${tests}, Failures: ${failures}, Time: ${time}s`);
  }

  const successRate = totalTests > 0 ? (totalTests - totalFailures - totalErrors) / totalTests : 1;
  const avgTestTime = totalTests > 0 ? totalTime / totalTests : 0;

  const timestamp = Date.now();
  const lines = [
    `# HELP axia_ci_tests_total Total number of CI tests run`,
    `# TYPE axia_ci_tests_total counter`,
    `axia_ci_tests_total ${totalTests} ${timestamp}`,

    `# HELP axia_ci_failures_total Total number of CI test failures`,
    `# TYPE axia_ci_failures_total counter`,
    `axia_ci_failures_total ${totalFailures} ${timestamp}`,

    `# HELP axia_ci_errors_total Total number of CI test errors`,
    `# TYPE axia_ci_errors_total counter`,
    `axia_ci_errors_total ${totalErrors} ${timestamp}`,

    `# HELP axia_ci_skipped_total Total number of CI tests skipped`,
    `# TYPE axia_ci_skipped_total counter`,
    `axia_ci_skipped_total ${totalSkipped} ${timestamp}`,

    `# HELP axia_ci_duration_seconds Total time spent running CI tests`,
    `# TYPE axia_ci_duration_seconds gauge`,
    `axia_ci_duration_seconds ${totalTime} ${timestamp}`,

    `# HELP axia_ci_success_rate Ratio of successful tests to total tests`,
    `# TYPE axia_ci_success_rate gauge`,
    `axia_ci_success_rate ${successRate} ${timestamp}`,

    `# HELP axia_ci_avg_test_duration_seconds Average duration per test`,
    `# TYPE axia_ci_avg_test_duration_seconds gauge`,
    `axia_ci_avg_test_duration_seconds ${avgTestTime} ${timestamp}`
  ].join('\n') + '\n';

  const url = `${pushUrl}/metrics/job/ci_tests`;
  let pushUrl_final = url;

  if (jobLabels) {
    const labels = jobLabels.split(',').map(label => {
      const [key, value] = label.split('=');
      return `${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
    }).join('/');
    pushUrl_final = `${url}/${labels}`;
  }

  if (isLocalhost) {
    console.warn(`⚠️  PUSHGATEWAY_URL points to localhost (${pushUrl}) — skipping network push`);
    console.log(`📈 Metrics Summary (not pushed):`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Failures: ${totalFailures}`);
    console.log(`   Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${totalTime.toFixed(2)}s`);
    process.exit(0);
  }

  console.log(`🚀 Pushing metrics to ${pushUrl_final}`);

  try {
    const response = await fetch(pushUrl_final, {
      method: 'POST',
      body: lines,
      headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Pushgateway returned ${response.status}: ${errorText} — metrics not pushed`);
      process.exit(0);
    }

    console.log('✅ Successfully pushed CI test metrics to Prometheus Pushgateway');
    console.log(`📈 Metrics Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Failures: ${totalFailures}`);
    console.log(`   Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${totalTime.toFixed(2)}s`);

  } catch (networkErr) {
    console.warn(`⚠️  Metrics push failed (network): ${networkErr.message} — continuing`);
    process.exit(0);
  }
}

convertAndPush();
