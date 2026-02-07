#!/usr/bin/env node

/**
 * Linera SDK Test Script (Node.js)
 *
 * Tests the parts of the Linera SDK that work in Node.js:
 *   1. @linera/signer PrivateKey - creates signer, signs messages
 *   2. Faucet HTTP API - tests real connectivity to Testnet Conway
 *   3. linera service - tests application GraphQL if running
 *
 * NOTE: The @linera/client WASM module (Faucet, Client, Chain, Application)
 * requires a browser environment. To test the full SDK, open:
 *   http://localhost:3000/test-sdk
 *
 * Usage: node scripts/test-sdk.mjs
 */

import { ethers } from 'ethers';

const FAUCET_URL = 'https://faucet.testnet-conway.linera.net';
const SERVICE_URL = process.env.NEXT_PUBLIC_LINERA_RPC || 'http://localhost:8080';
const CHAIN_ID = process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd';
const APP_ID = process.env.NEXT_PUBLIC_LINERA_APP_ID || '23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d';

let passed = 0;
let failed = 0;

function pass(name, detail = '') {
  passed++;
  console.log(`  [PASS] ${name}${detail ? ' - ' + detail : ''}`);
}

function fail(name, detail = '') {
  failed++;
  console.log(`  [FAIL] ${name}${detail ? ' - ' + detail : ''}`);
}

// ============================================================
// Test 1: @linera/signer PrivateKey (works in Node.js)
// ============================================================
async function testSigner() {
  console.log('\n--- Test: @linera/signer PrivateKey ---');
  try {
    // Import private-key directly (the package index.js doesn't have .js extensions for Node ESM)
    const { PrivateKey } = await import('@linera/signer/dist/private-key.js');

    // Create a random Ethereum wallet and use its key
    const wallet = ethers.Wallet.createRandom();
    const signer = new PrivateKey(wallet.privateKey);

    const address = signer.address();
    if (!address || !address.startsWith('0x')) {
      fail('signer.address()', `got: ${address}`);
      return;
    }
    pass('signer.address()', address);

    // Test containsKey
    const hasKey = await signer.containsKey(address);
    if (!hasKey) {
      fail('signer.containsKey()', 'returned false');
      return;
    }
    pass('signer.containsKey()', 'true');

    // Test signing
    const message = new Uint8Array([1, 2, 3, 4]);
    const signature = await signer.sign(address, message);
    if (!signature || signature.length < 10) {
      fail('signer.sign()', 'signature too short');
      return;
    }
    pass('signer.sign()', `${signature.slice(0, 30)}...`);

  } catch (err) {
    fail('signer import', err.message);
  }
}

// ============================================================
// Test 2: Faucet HTTP Connectivity (Testnet Conway)
// ============================================================
async function testFaucet() {
  console.log('\n--- Test: Faucet HTTP (Testnet Conway) ---');
  try {
    const res = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ version }' }),
    });

    if (!res.ok) {
      fail('faucet connectivity', `HTTP ${res.status}`);
      return;
    }

    const json = await res.json();
    const version = json.data?.version;
    if (version) {
      pass('faucet connectivity', `version: ${JSON.stringify(version).slice(0, 80)}`);
    } else {
      fail('faucet connectivity', 'no version in response');
    }
  } catch (err) {
    fail('faucet connectivity', err.message);
  }
}

// ============================================================
// Test 3: Faucet claim (creates real chain on Testnet Conway)
// ============================================================
async function testFaucetClaim() {
  console.log('\n--- Test: Faucet Claim (real chain creation) ---');
  try {
    const wallet = ethers.Wallet.createRandom();
    const owner = wallet.address;

    // The faucet expects an AccountOwner which is an EIP-191 address
    const res = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { claim(owner: "${owner}") }`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      fail('faucet claim', `HTTP ${res.status}: ${text.slice(0, 200)}`);
      return;
    }

    const json = await res.json();
    if (json.errors) {
      // This is expected - the faucet claim format may differ via raw HTTP vs SDK
      fail('faucet claim (raw HTTP)', json.errors[0]?.message || JSON.stringify(json.errors).slice(0, 200));
      console.log('    NOTE: This is expected for raw HTTP. The SDK handles the claim protocol.');
      console.log('    Open http://localhost:3000/test-sdk for full SDK claim test.');
    } else {
      pass('faucet claim', JSON.stringify(json.data).slice(0, 200));
    }
  } catch (err) {
    fail('faucet claim', err.message);
  }
}

// ============================================================
// Test 4: linera service (application GraphQL)
// ============================================================
async function testLocalService() {
  console.log('\n--- Test: linera service (Application GraphQL) ---');
  const endpoint = `${SERVICE_URL}/chains/${CHAIN_ID}/applications/${APP_ID}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ nextGameId }' }),
    });

    if (!res.ok) {
      fail('linera service', `HTTP ${res.status}`);
      return;
    }

    const json = await res.json();
    if (json.errors) {
      fail('nextGameId query', JSON.stringify(json.errors).slice(0, 200));
      return;
    }

    pass('nextGameId query', `nextGameId = ${json.data?.nextGameId}`);

    // Also query totalFunds
    const res2 = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ totalFunds }' }),
    });
    const json2 = await res2.json();
    if (!json2.errors) {
      pass('totalFunds query', `totalFunds = ${json2.data?.totalFunds}`);
    }

    // Query game history
    const res3 = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ gameHistory { gameId gameType betAmount } }' }),
    });
    const json3 = await res3.json();
    if (!json3.errors) {
      const games = json3.data?.gameHistory || [];
      pass('gameHistory query', `${games.length} games recorded`);
    }

  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      fail('linera service', 'not running. Start with: linera service --port 8080');
    } else {
      fail('linera service', err.message);
    }
  }
}

// ============================================================
// Test 5: WASM module (should fail in Node.js - that's expected)
// ============================================================
async function testWASM() {
  console.log('\n--- Test: @linera/client WASM (expect Node.js failure) ---');
  try {
    const mod = await import('@linera/client');
    if (mod.default) {
      await mod.default();
      pass('WASM init', 'unexpectedly worked in Node.js!');
    } else {
      fail('WASM init', 'no default export');
    }
  } catch (err) {
    // Expected to fail in Node.js
    console.log(`  [INFO] WASM not available in Node.js (expected): ${err.message.slice(0, 100)}`);
    console.log('  [INFO] Open http://localhost:3000/test-sdk to test WASM SDK in browser');
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('==============================================');
  console.log(' Linera SDK Test (Node.js)');
  console.log('==============================================');
  console.log(`Faucet URL:  ${FAUCET_URL}`);
  console.log(`Service URL: ${SERVICE_URL}`);
  console.log(`Chain ID:    ${CHAIN_ID}`);
  console.log(`App ID:      ${APP_ID}`);

  await testSigner();
  await testFaucet();
  await testFaucetClaim();
  await testLocalService();
  await testWASM();

  console.log('\n==============================================');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log('==============================================');

  if (failed > 0) {
    console.log('\nTo test the full WASM SDK (browser-only):');
    console.log('  1. npm run dev');
    console.log('  2. Open http://localhost:3000/test-sdk');
    console.log('  3. Click "Run Full SDK Test"');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
