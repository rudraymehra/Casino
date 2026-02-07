#!/usr/bin/env node

/**
 * Linera Connection Verification Script
 *
 * Tests connectivity to:
 * 1. Linera Testnet Conway faucet
 * 2. Local linera service (required for application-level GraphQL)
 * 3. Casino application endpoint
 *
 * Usage: node scripts/verify-connection.js
 */

const FAUCET_URL = process.env.NEXT_PUBLIC_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net';
const SERVICE_URL = process.env.NEXT_PUBLIC_LINERA_RPC || 'http://localhost:8080';
const CHAIN_ID = process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd';
const APP_ID = process.env.NEXT_PUBLIC_LINERA_APP_ID || '23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d';

async function graphqlRequest(url, query) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function testFaucet() {
  console.log('\n--- Faucet Connectivity ---');
  console.log(`URL: ${FAUCET_URL}`);
  try {
    const result = await graphqlRequest(FAUCET_URL, '{ version }');
    if (result.data?.version) {
      console.log(`[PASS] Faucet reachable. Version: ${result.data.version}`);
      return true;
    }
    console.log('[WARN] Faucet responded but no version field:', JSON.stringify(result));
    return true;
  } catch (error) {
    console.log(`[FAIL] Faucet unreachable: ${error.message}`);
    return false;
  }
}

async function testLocalService() {
  console.log('\n--- Local Linera Service ---');
  console.log(`URL: ${SERVICE_URL}`);
  try {
    // The service root responds to a simple introspection query
    const res = await fetch(SERVICE_URL, { method: 'GET' });
    if (res.ok) {
      console.log('[PASS] linera service is running');
      return true;
    }
    // Some versions only respond to POST
    const result = await graphqlRequest(SERVICE_URL, '{ __typename }');
    console.log('[PASS] linera service is running');
    return true;
  } catch (error) {
    console.log(`[FAIL] linera service not reachable: ${error.message}`);
    console.log('       Run: linera service --port 8080');
    return false;
  }
}

async function testApplicationEndpoint() {
  console.log('\n--- Casino Application Endpoint ---');
  const endpoint = `${SERVICE_URL}/chains/${CHAIN_ID}/applications/${APP_ID}`;
  console.log(`URL: ${endpoint}`);
  try {
    const result = await graphqlRequest(endpoint, '{ __typename }');
    if (result.errors) {
      console.log(`[WARN] Endpoint responded with errors: ${JSON.stringify(result.errors)}`);
      console.log('       The application may not be deployed on this chain.');
      return false;
    }
    console.log('[PASS] Casino application is available');
    return true;
  } catch (error) {
    console.log(`[FAIL] Casino application not reachable: ${error.message}`);
    return false;
  }
}

async function testCasinoQueries() {
  console.log('\n--- Casino Contract Queries ---');
  const endpoint = `${SERVICE_URL}/chains/${CHAIN_ID}/applications/${APP_ID}`;

  const queries = [
    { name: 'nextGameId', query: '{ nextGameId }' },
    { name: 'totalFunds', query: '{ totalFunds }' },
  ];

  let allPassed = true;
  for (const { name, query } of queries) {
    try {
      const result = await graphqlRequest(endpoint, query);
      if (result.errors) {
        console.log(`  [WARN] ${name}: ${JSON.stringify(result.errors)}`);
        allPassed = false;
      } else {
        console.log(`  [PASS] ${name}: ${JSON.stringify(result.data)}`);
      }
    } catch (error) {
      console.log(`  [FAIL] ${name}: ${error.message}`);
      allPassed = false;
    }
  }
  return allPassed;
}

async function main() {
  console.log('===========================================');
  console.log(' Linera Connection Verification');
  console.log('===========================================');
  console.log(`Chain ID:  ${CHAIN_ID}`);
  console.log(`App ID:    ${APP_ID}`);

  const results = {};
  results.faucet = await testFaucet();
  results.localService = await testLocalService();

  if (results.localService) {
    results.appEndpoint = await testApplicationEndpoint();
    if (results.appEndpoint) {
      results.queries = await testCasinoQueries();
    }
  }

  console.log('\n===========================================');
  console.log(' Summary');
  console.log('===========================================');
  console.log(`Faucet:           ${results.faucet ? 'OK' : 'FAIL'}`);
  console.log(`Local Service:    ${results.localService ? 'OK' : 'FAIL'}`);
  console.log(`App Endpoint:     ${results.appEndpoint ? 'OK' : results.localService ? 'FAIL' : 'SKIPPED'}`);
  console.log(`Contract Queries: ${results.queries ? 'OK' : results.appEndpoint ? 'FAIL' : 'SKIPPED'}`);

  if (!results.localService) {
    console.log('\nTo start the local service:');
    console.log('  linera service --port 8080');
  }

  const allOk = Object.values(results).every(v => v === true);
  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
