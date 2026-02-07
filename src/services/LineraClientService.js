/**
 * Linera Client Service - Browser-side SDK Integration
 *
 * Uses @linera/client WASM module for real blockchain interaction.
 * The SDK provides: Faucet, Client, Chain, Application, signer.PrivateKey
 *
 * Correct interaction flow:
 *   initialize WASM -> Faucet.createWallet() -> Client(wallet, signer)
 *   -> client.chain(chainId) -> chain.application(appId) -> app.query(graphql)
 *
 * NOTE: This module only works in the browser (WASM requirement).
 * Server-side code should use LineraClient.js instead.
 */

import { LINERA_CONFIG } from '@/config/lineraConfig';

let lineraModule = null;
let isInitialized = false;
let initPromise = null;

/**
 * Initialize the Linera WASM module.
 * Must be called before any SDK operations.
 */
export async function initializeLineraClient() {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof window === 'undefined') {
        console.warn('LineraClientService: Server-side environment detected, WASM not available');
        return false;
      }

      console.log('Initializing Linera WASM client...');

      const clientModule = await import('@linera/client');

      // Call the default export to initialize WASM runtime
      if (clientModule.default) {
        await clientModule.default();
      }

      lineraModule = clientModule;
      isInitialized = true;
      console.log('Linera WASM client initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Linera WASM client:', error);
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Create a wallet via the Linera Faucet.
 * Returns { wallet, owner, chainId }.
 */
export async function createWalletFromFaucet() {
  if (!isInitialized) {
    const ok = await initializeLineraClient();
    if (!ok) throw new Error('WASM not initialized');
  }

  const { Faucet } = lineraModule;
  const faucetUrl = LINERA_CONFIG.NETWORK.faucetUrl;
  const faucet = new Faucet(faucetUrl);

  const wallet = await faucet.createWallet();
  return wallet;
}

/**
 * Claim a new chain from the faucet for an existing wallet.
 */
export async function claimChainFromFaucet(wallet, owner) {
  if (!isInitialized) {
    const ok = await initializeLineraClient();
    if (!ok) throw new Error('WASM not initialized');
  }

  const { Faucet } = lineraModule;
  const faucetUrl = LINERA_CONFIG.NETWORK.faucetUrl;
  const faucet = new Faucet(faucetUrl);

  return faucet.claimChain(wallet, owner);
}

/**
 * Create a PrivateKey signer from a hex private key.
 */
export async function createSigner(privateKeyHex) {
  if (!isInitialized) {
    const ok = await initializeLineraClient();
    if (!ok) throw new Error('WASM not initialized');
  }

  // Try the SDK's signer first
  if (lineraModule?.signer?.PrivateKey) {
    return new lineraModule.signer.PrivateKey(privateKeyHex);
  }

  // Fallback: import @linera/signer directly
  const { PrivateKey } = await import('@linera/signer');
  return new PrivateKey(privateKeyHex);
}

/**
 * Get the owner/address from a signer.
 */
export function getSignerAddress(signer) {
  if (!signer) throw new Error('Signer not provided');
  return signer.address();
}

/**
 * Create a Client instance from a wallet and signer.
 * The Client constructor in WASM is async (returns a Promise).
 * The Client is the main entry point for chain/application interactions.
 */
export async function createClient(wallet, signer, options = null) {
  if (!isInitialized) {
    const ok = await initializeLineraClient();
    if (!ok) throw new Error('WASM not initialized');
  }

  const { Client } = lineraModule;
  // WASM Client constructor returns a Promise
  return await new Client(wallet, signer, options);
}

/**
 * Get a Chain handle from a Client.
 * client.chain() is async in the WASM SDK.
 */
export async function getChain(client, chainId) {
  const cid = chainId || LINERA_CONFIG.NETWORK.chainId;
  return await client.chain(cid);
}

/**
 * Get an Application handle from a Chain.
 * chain.application() is async in the WASM SDK.
 */
export async function getApplication(chain, applicationId) {
  const appId = applicationId || LINERA_CONFIG.NETWORK.applicationId;
  return await chain.application(appId);
}

/**
 * Execute a GraphQL query/mutation on the casino application via the SDK.
 * app.query() returns a JSON string, so we parse it.
 */
export async function applicationQuery(app, graphqlString, options = null) {
  const raw = await app.query(graphqlString, options);
  // The SDK returns a JSON string; parse it to extract the data
  try {
    const parsed = JSON.parse(raw);
    // Linera wraps in { data: ... }, unwrap if present
    return parsed.data !== undefined ? parsed.data : parsed;
  } catch {
    return raw;
  }
}

/**
 * Full end-to-end connection: init WASM -> Faucet -> Wallet -> Signer ->
 * claimChain -> Client -> Chain -> Application.
 * Returns { client, chain, app, chainId, owner } ready for use.
 */
export async function connectToTestnet(privateKeyHex = null) {
  await initializeLineraClient();

  const { Faucet } = lineraModule;
  const { ethers } = await import('ethers');
  const { PrivateKey } = await import('@linera/signer');

  // Create or use provided key
  const wallet_ = privateKeyHex
    ? new ethers.Wallet(privateKeyHex)
    : ethers.Wallet.createRandom();
  const signer = new PrivateKey(wallet_.privateKey);
  const owner = signer.address();

  // Faucet interaction
  const faucetUrl = LINERA_CONFIG.NETWORK.faucetUrl;
  const faucet = new Faucet(faucetUrl);
  const lineraWallet = await faucet.createWallet();
  const chainId = await faucet.claimChain(lineraWallet, owner);

  // Create full client
  const client = await new lineraModule.Client(lineraWallet, signer);
  const chain = await client.chain(chainId);
  const app = await chain.application(LINERA_CONFIG.NETWORK.applicationId);

  return { client, chain, app, chainId, owner, signer };
}

// ----- Casino-specific operations -----

/**
 * Deposit tokens into the casino contract.
 */
export async function deposit(app, amount) {
  const amountAttos = Math.floor(parseFloat(amount) * 1e18).toString();
  const mutation = `mutation { deposit(amount: "${amountAttos}") }`;
  return applicationQuery(app, mutation);
}

/**
 * Withdraw tokens from the casino contract.
 */
export async function withdraw(app, amount) {
  const amountAttos = Math.floor(parseFloat(amount) * 1e18).toString();
  const mutation = `mutation { withdraw(amount: "${amountAttos}") }`;
  return applicationQuery(app, mutation);
}

/**
 * Place a bet on the casino contract.
 */
export async function placeBet(app, gameType, betAmount, commitHash, gameParams = {}) {
  const amountAttos = Math.floor(parseFloat(betAmount) * 1e18).toString();
  const paramsJson = JSON.stringify(gameParams);

  const mutation = `
    mutation {
      placeBet(
        gameType: "${gameType}"
        betAmount: "${amountAttos}"
        commitHash: "${commitHash}"
        gameParams: ${JSON.stringify(paramsJson)}
      )
    }
  `;

  return applicationQuery(app, mutation);
}

/**
 * Reveal the commit for a game.
 */
export async function reveal(app, gameId, revealValue) {
  const mutation = `
    mutation {
      reveal(gameId: ${parseInt(gameId)}, revealValue: "${revealValue}")
    }
  `;
  return applicationQuery(app, mutation);
}

/**
 * Query player balance (read-only).
 */
export async function queryBalance(app, owner) {
  const query = `query { playerBalance(owner: "${owner}") }`;
  const result = await applicationQuery(app, query);
  const balanceAttos = result?.playerBalance || '0';
  return parseFloat(balanceAttos) / 1e18;
}

/**
 * Query game history (read-only).
 */
export async function queryGameHistory(app) {
  const query = `
    query {
      gameHistory {
        gameId
        gameType
        betAmount
        payoutAmount
        outcomeDetails
        timestamp
      }
    }
  `;
  const result = await applicationQuery(app, query);
  return result?.gameHistory || [];
}

/**
 * Query the chain's native token balance.
 */
export async function queryChainBalance(chain) {
  return chain.balance();
}

export default {
  initializeLineraClient,
  createWalletFromFaucet,
  claimChainFromFaucet,
  createSigner,
  getSignerAddress,
  createClient,
  getChain,
  getApplication,
  applicationQuery,
  connectToTestnet,
  deposit,
  withdraw,
  placeBet,
  reveal,
  queryBalance,
  queryGameHistory,
  queryChainBalance,
};
