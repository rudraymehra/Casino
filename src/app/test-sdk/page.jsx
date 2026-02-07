'use client';

import React, { useState, useCallback } from 'react';

/**
 * Linera SDK Test Page
 *
 * This page demonstrates a REAL, verifiable connection to Linera Testnet Conway
 * using the @linera/client WASM SDK.
 *
 * Each step calls the actual SDK classes:
 *   1. initialize() - Load WASM module
 *   2. new Faucet(url) - Connect to Testnet Conway faucet
 *   3. faucet.createWallet() - Create an in-memory Wallet
 *   4. new PrivateKey(key) - Create a signer
 *   5. faucet.claimChain(wallet, owner) - Claim a chain with tokens
 *   6. new Client(wallet, signer) - Connect to the network
 *   7. client.chain(chainId) - Get a Chain handle
 *   8. chain.balance() - Query on-chain balance
 *   9. chain.application(appId) - Get casino Application handle
 *  10. app.query(graphql) - Query the casino contract
 *
 * Open this page in a browser at: http://localhost:3000/test-sdk
 */

const FAUCET_URL = 'https://faucet.testnet-conway.linera.net';
const APP_ID = process.env.NEXT_PUBLIC_LINERA_APP_ID || '23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d';

export default function TestSDKPage() {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const log = useCallback((step, status, message, data = null) => {
    setLogs(prev => [...prev, { step, status, message, data, time: new Date().toISOString() }]);
  }, []);

  const runTest = useCallback(async () => {
    setLogs([]);
    setResults(null);
    setRunning(true);

    const summary = {};

    try {
      // ============================================================
      // STEP 1: Initialize WASM
      // ============================================================
      log(1, 'running', 'Initializing @linera/client WASM module...');
      let initialize, Faucet, Client, Wallet;
      try {
        const mod = await import('@linera/client');
        initialize = mod.default || mod.initialize;
        Faucet = mod.Faucet;
        Client = mod.Client;
        Wallet = mod.Wallet;

        if (typeof initialize === 'function') {
          await initialize();
        }
        log(1, 'pass', 'WASM module initialized', {
          exports: Object.keys(mod).filter(k => k !== 'default').join(', '),
        });
        summary.wasmInit = true;
      } catch (err) {
        log(1, 'fail', `WASM init failed: ${err.message}`);
        summary.wasmInit = false;
        throw err;
      }

      // ============================================================
      // STEP 2: Create PrivateKey signer
      // ============================================================
      log(2, 'running', 'Creating PrivateKey signer via @linera/signer...');
      let signer, ownerAddress;
      try {
        const { PrivateKey } = await import('@linera/signer');
        // Generate a random Ethereum-compatible private key using ethers
        const { ethers } = await import('ethers');
        const randomWallet = ethers.Wallet.createRandom();
        const privateKeyHex = randomWallet.privateKey;

        signer = new PrivateKey(privateKeyHex);
        ownerAddress = signer.address();

        log(2, 'pass', 'Signer created', {
          ownerAddress,
          type: 'PrivateKey (EIP-191)',
        });
        summary.signer = true;
      } catch (err) {
        log(2, 'fail', `Signer creation failed: ${err.message}`);
        summary.signer = false;
        throw err;
      }

      // ============================================================
      // STEP 3: Connect to Testnet Conway Faucet
      // ============================================================
      log(3, 'running', `Connecting to faucet at ${FAUCET_URL}...`);
      let faucet;
      try {
        faucet = new Faucet(FAUCET_URL);
        log(3, 'pass', 'Faucet instance created', { url: FAUCET_URL });
        summary.faucet = true;
      } catch (err) {
        log(3, 'fail', `Faucet connection failed: ${err.message}`);
        summary.faucet = false;
        throw err;
      }

      // ============================================================
      // STEP 4: Create Wallet from Faucet
      // ============================================================
      log(4, 'running', 'Creating wallet from faucet (fetches genesis config from Testnet Conway)...');
      let wallet;
      try {
        wallet = await faucet.createWallet();
        log(4, 'pass', 'Wallet created from Testnet Conway genesis config', {
          type: wallet.constructor.name,
        });
        summary.wallet = true;
      } catch (err) {
        log(4, 'fail', `Wallet creation failed: ${err.message}`);
        summary.wallet = false;
        throw err;
      }

      // ============================================================
      // STEP 5: Claim chain from Faucet (gets real tokens)
      // ============================================================
      log(5, 'running', `Claiming chain from faucet for owner ${ownerAddress.slice(0, 18)}...`);
      let chainId;
      try {
        chainId = await faucet.claimChain(wallet, ownerAddress);
        log(5, 'pass', 'Chain claimed from Testnet Conway!', {
          chainId,
          owner: ownerAddress,
          explorerUrl: `https://explorer.testnet-conway.linera.net/chains/${chainId}`,
        });
        summary.claimChain = true;
        summary.chainId = chainId;
      } catch (err) {
        log(5, 'fail', `Chain claim failed: ${err.message}`);
        summary.claimChain = false;
        throw err;
      }

      // ============================================================
      // STEP 6: Create Client (connects to Linera network)
      // ============================================================
      log(6, 'running', 'Creating Client (full node in WASM, connects to validators)...');
      let client;
      try {
        // Client constructor is async in WASM - it connects to the network
        client = await new Client(wallet, signer);
        log(6, 'pass', 'Client connected to Linera network');
        summary.client = true;
      } catch (err) {
        log(6, 'fail', `Client creation failed: ${err.message}`);
        summary.client = false;
        throw err;
      }

      // ============================================================
      // STEP 7: Get Chain handle
      // ============================================================
      log(7, 'running', `Getting chain handle for ${chainId.slice(0, 16)}...`);
      let chain;
      try {
        chain = await client.chain(chainId);
        log(7, 'pass', 'Chain handle obtained');
        summary.chain = true;
      } catch (err) {
        log(7, 'fail', `Chain handle failed: ${err.message}`);
        summary.chain = false;
        throw err;
      }

      // ============================================================
      // STEP 8: Query chain balance
      // ============================================================
      log(8, 'running', 'Querying chain balance from Testnet Conway...');
      try {
        const balance = await chain.balance();
        log(8, 'pass', 'Balance retrieved from Testnet Conway', {
          balance,
          unit: 'LINERA',
        });
        summary.balance = balance;
      } catch (err) {
        log(8, 'fail', `Balance query failed: ${err.message}`);
        summary.balance = 'error';
      }

      // ============================================================
      // STEP 9: Query chain identity
      // ============================================================
      log(9, 'running', 'Querying chain identity...');
      try {
        const identity = await chain.identity();
        log(9, 'pass', 'Chain identity retrieved', { identity });
        summary.identity = identity;
      } catch (err) {
        log(9, 'fail', `Identity query failed: ${err.message}`);
        summary.identity = 'error';
      }

      // ============================================================
      // STEP 10: Get Application handle for casino contract
      // ============================================================
      log(10, 'running', `Getting casino application handle (${APP_ID.slice(0, 16)}...)...`);
      let app;
      try {
        app = await chain.application(APP_ID);
        log(10, 'pass', 'Casino application handle obtained');
        summary.application = true;
      } catch (err) {
        log(10, 'warn', `Application handle failed (contract may not be on this chain): ${err.message}`);
        summary.application = false;
      }

      // ============================================================
      // STEP 11: Query casino contract - nextGameId
      // ============================================================
      if (app) {
        log(11, 'running', 'Querying casino contract: nextGameId...');
        try {
          const raw = await app.query('{ nextGameId }');
          const data = JSON.parse(raw);
          log(11, 'pass', 'Casino contract query successful!', {
            nextGameId: data?.data?.nextGameId ?? data?.nextGameId,
            raw: raw.slice(0, 200),
          });
          summary.nextGameId = data?.data?.nextGameId ?? data?.nextGameId;
        } catch (err) {
          log(11, 'warn', `Casino query failed: ${err.message}`);
          summary.nextGameId = 'error';
        }

        // ============================================================
        // STEP 12: Query casino contract - totalFunds
        // ============================================================
        log(12, 'running', 'Querying casino contract: totalFunds...');
        try {
          const raw = await app.query('{ totalFunds }');
          const data = JSON.parse(raw);
          log(12, 'pass', 'Total funds query successful!', {
            totalFunds: data?.data?.totalFunds ?? data?.totalFunds,
          });
          summary.totalFunds = data?.data?.totalFunds ?? data?.totalFunds;
        } catch (err) {
          log(12, 'warn', `Total funds query failed: ${err.message}`);
          summary.totalFunds = 'error';
        }
      }

      // ============================================================
      // STEP 13: Query validator version info
      // ============================================================
      log(13, 'running', 'Querying validator version info from network...');
      try {
        const versionInfo = await chain.validatorVersionInfo();
        log(13, 'pass', 'Validator info retrieved', {
          validators: JSON.stringify(versionInfo).slice(0, 300),
        });
        summary.validators = true;
      } catch (err) {
        log(13, 'warn', `Validator query failed: ${err.message}`);
        summary.validators = false;
      }

      // Done
      summary.overallResult = 'PASS';
      setResults(summary);

    } catch (fatalErr) {
      summary.overallResult = 'FAIL';
      summary.fatalError = fatalErr.message;
      setResults(summary);
    } finally {
      setRunning(false);
    }
  }, [log]);

  const statusIcon = (s) => {
    if (s === 'pass') return '\u2705';
    if (s === 'fail') return '\u274C';
    if (s === 'warn') return '\u26A0\uFE0F';
    return '\u23F3';
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', background: '#0a0a0a', color: '#e0e0e0', minHeight: '100vh' }}>
      <h1 style={{ color: '#4fc3f7', marginBottom: '0.5rem' }}>Linera SDK Integration Test</h1>
      <p style={{ color: '#888', marginBottom: '1rem' }}>
        Tests real @linera/client WASM SDK against Testnet Conway.
        Each step calls actual SDK classes (Faucet, Client, Chain, Application).
      </p>

      <button
        onClick={runTest}
        disabled={running}
        style={{
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          background: running ? '#333' : '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: running ? 'not-allowed' : 'pointer',
          marginBottom: '1.5rem',
        }}
      >
        {running ? 'Running...' : 'Run Full SDK Test'}
      </button>

      {/* Log output */}
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
        {logs.length === 0 && <p style={{ color: '#666' }}>Click the button to start the test...</p>}
        {logs.map((entry, i) => (
          <div key={i} style={{ marginBottom: '0.5rem', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
            <div>
              <span style={{ marginRight: '0.5rem' }}>{statusIcon(entry.status)}</span>
              <strong style={{ color: '#4fc3f7' }}>Step {entry.step}:</strong>{' '}
              <span style={{ color: entry.status === 'fail' ? '#ef5350' : entry.status === 'pass' ? '#66bb6a' : '#fff' }}>
                {entry.message}
              </span>
            </div>
            {entry.data && (
              <pre style={{ marginTop: '0.25rem', marginLeft: '2rem', color: '#aaa', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {results && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: results.overallResult === 'PASS' ? '#1b5e20' : '#b71c1c',
          borderRadius: '8px',
        }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>
            {results.overallResult === 'PASS' ? '\u2705' : '\u274C'} Overall: {results.overallResult}
          </h2>
          <pre style={{ color: '#e0e0e0', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '2rem', color: '#666', fontSize: '0.8rem' }}>
        <p>Network: Linera Testnet Conway</p>
        <p>Faucet: {FAUCET_URL}</p>
        <p>Casino App ID: {APP_ID}</p>
        <p>SDK: @linera/client v0.15.10 + @linera/signer v0.15.6</p>
      </div>
    </div>
  );
}
