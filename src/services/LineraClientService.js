/**
 * Linera Client Service - Browser-side Transaction Signing
 *
 * Uses @linera/client WASM module to sign transactions on the client side.
 * This is required because Linera operations need authenticated_signer().
 *
 * Flow:
 * 1. Initialize WASM module
 * 2. Create/load wallet with private key
 * 3. Sign mutations before sending to blockchain
 */

import { LINERA_CONFIG } from '@/config/lineraConfig';

// Dynamic import for WASM - only works in browser
let lineraClient = null;
let isInitialized = false;
let initPromise = null;

/**
 * Initialize the Linera WASM client
 * Must be called before any operations
 */
export async function initializeLineraClient() {
  if (isInitialized) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      if (typeof window === 'undefined') {
        console.log('LineraClientService: Server-side, skipping WASM init');
        return false;
      }

      console.log('Initializing Linera WASM client...');

      // Dynamic import of the client module
      const clientModule = await import('@linera/client');

      // Initialize WASM
      if (clientModule.default) {
        await clientModule.default();
      }

      lineraClient = clientModule;
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
 * Create a PrivateKey signer from hex private key
 * Uses ethers-compatible signing (EIP-191)
 */
export async function createSigner(privateKeyHex) {
  if (!isInitialized) {
    await initializeLineraClient();
  }

  if (!lineraClient?.signer?.PrivateKey) {
    // Fallback: try @linera/signer package directly
    try {
      const { PrivateKey } = await import('@linera/signer');
      return new PrivateKey(privateKeyHex);
    } catch (error) {
      console.error('Failed to import PrivateKey signer:', error);
      throw new Error('Linera signer not available');
    }
  }

  return new lineraClient.signer.PrivateKey(privateKeyHex);
}

/**
 * Create a random signer (for testing)
 */
export async function createRandomSigner() {
  if (!isInitialized) {
    await initializeLineraClient();
  }

  try {
    const { PrivateKey } = await import('@linera/signer');
    return PrivateKey.createRandom();
  } catch (error) {
    console.error('Failed to create random signer:', error);
    throw error;
  }
}

/**
 * Sign a message with the signer
 * @param {Object} signer - PrivateKey signer instance
 * @param {string} owner - Owner address (must match signer)
 * @param {Uint8Array} message - Message to sign
 * @returns {Promise<string>} Signature
 */
export async function signMessage(signer, owner, message) {
  if (!signer) {
    throw new Error('Signer not provided');
  }

  // Verify the signer owns this address
  const containsKey = await signer.containsKey(owner);
  if (!containsKey) {
    throw new Error('Signer does not contain key for this owner');
  }

  return signer.sign(owner, message);
}

/**
 * Get the address/owner from a signer
 */
export function getSignerAddress(signer) {
  if (!signer) {
    throw new Error('Signer not provided');
  }
  return signer.address();
}

/**
 * Make a signed GraphQL mutation to the Linera application
 * @param {Object} signer - PrivateKey signer
 * @param {string} mutation - GraphQL mutation string
 * @param {Object} variables - GraphQL variables
 */
export async function signedMutation(signer, mutation, variables = {}) {
  const endpoint = LINERA_CONFIG.getGraphQLEndpoint();
  const owner = getSignerAddress(signer);

  console.log('Executing signed mutation...');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Owner: ${owner.slice(0, 16)}...`);

  // For Linera, the signature needs to be included with the operation
  // The mutation payload needs to be signed and included in the request

  // Create the operation payload
  const operationPayload = {
    query: mutation,
    variables,
  };

  // Convert to bytes for signing
  const payloadBytes = new TextEncoder().encode(JSON.stringify(operationPayload));

  // Sign the payload
  const signature = await signMessage(signer, owner, payloadBytes);

  // Make the request with signature header
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Linera-Owner': owner,
      'X-Linera-Signature': signature,
    },
    body: JSON.stringify(operationPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linera mutation failed: ${response.status} - ${text}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Linera GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

/**
 * Execute a deposit operation (signed)
 */
export async function deposit(signer, amount) {
  const amountAttos = Math.floor(parseFloat(amount) * 1e18).toString();

  const mutation = `
    mutation Deposit($amount: String!) {
      deposit(amount: $amount)
    }
  `;

  return signedMutation(signer, mutation, { amount: amountAttos });
}

/**
 * Execute a withdrawal operation (signed)
 */
export async function withdraw(signer, amount) {
  const amountAttos = Math.floor(parseFloat(amount) * 1e18).toString();

  const mutation = `
    mutation Withdraw($amount: String!) {
      withdraw(amount: $amount)
    }
  `;

  return signedMutation(signer, mutation, { amount: amountAttos });
}

/**
 * Place a bet operation (signed)
 */
export async function placeBet(signer, gameType, betAmount, commitHash, gameParams = {}) {
  const amountAttos = Math.floor(parseFloat(betAmount) * 1e18).toString();

  const mutation = `
    mutation PlaceBet($gameType: String!, $betAmount: String!, $commitHash: String!, $gameParams: String!) {
      placeBet(
        gameType: $gameType
        betAmount: $betAmount
        commitHash: $commitHash
        gameParams: $gameParams
      )
    }
  `;

  return signedMutation(signer, mutation, {
    gameType,
    betAmount: amountAttos,
    commitHash,
    gameParams: JSON.stringify(gameParams),
  });
}

/**
 * Reveal operation (signed)
 */
export async function reveal(signer, gameId, revealValue) {
  const mutation = `
    mutation Reveal($gameId: Int!, $revealValue: String!) {
      reveal(gameId: $gameId, revealValue: $revealValue)
    }
  `;

  return signedMutation(signer, mutation, {
    gameId: parseInt(gameId),
    revealValue,
  });
}

/**
 * Query player balance (unsigned - read operation)
 */
export async function queryBalance(owner) {
  const endpoint = LINERA_CONFIG.getGraphQLEndpoint();

  const query = `
    query GetBalance($owner: String!) {
      playerBalance(owner: $owner)
    }
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { owner } }),
  });

  if (!response.ok) {
    throw new Error(`Balance query failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Query error: ${result.errors.map(e => e.message).join(', ')}`);
  }

  const balanceAttos = result.data?.playerBalance || '0';
  return parseFloat(balanceAttos) / 1e18;
}

/**
 * Query game history (unsigned - read operation)
 */
export async function queryGameHistory() {
  const endpoint = LINERA_CONFIG.getGraphQLEndpoint();

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`History query failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.warn('Game history query error:', result.errors);
    return [];
  }

  return result.data?.gameHistory || [];
}

export default {
  initializeLineraClient,
  createSigner,
  createRandomSigner,
  signMessage,
  getSignerAddress,
  signedMutation,
  deposit,
  withdraw,
  placeBet,
  reveal,
  queryBalance,
  queryGameHistory,
};
