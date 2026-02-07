/**
 * Linera GraphQL Service
 * Makes REAL HTTP requests to Linera blockchain nodes
 * No CLI dependency - works in browser and server
 */

const LINERA_ENDPOINTS = {
  // Linera Conway Testnet
  // Application-level GraphQL requires local linera service (run: linera service --port 8080)
  rpc: process.env.NEXT_PUBLIC_LINERA_RPC || 'http://localhost:8080',
  faucet: process.env.NEXT_PUBLIC_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net',
  explorer: 'https://explorer.testnet-conway.linera.net',
};

// MUST match .env.local values
const DEPLOYED_CONTRACT = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || '23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d',
};

/**
 * Make a GraphQL request to a Linera endpoint
 */
async function graphqlRequest(endpoint, query, variables = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

/**
 * Get the GraphQL endpoint for the casino application
 */
function getApplicationEndpoint() {
  return `${LINERA_ENDPOINTS.rpc}/chains/${DEPLOYED_CONTRACT.chainId}/applications/${DEPLOYED_CONTRACT.applicationId}`;
}

/**
 * Get the GraphQL endpoint for chain operations
 */
function getChainEndpoint() {
  return `${LINERA_ENDPOINTS.rpc}/chains/${DEPLOYED_CONTRACT.chainId}`;
}

/**
 * Claim tokens from the Linera faucet
 * This creates a NEW chain for the user with tokens
 */
export async function claimFromFaucet(publicKey) {
  console.log('🚰 Claiming from Linera faucet...');

  const query = `
    mutation ClaimChain($publicKey: String!) {
      claim(publicKey: $publicKey) {
        messageId
        chainId
        certificateHash
      }
    }
  `;

  try {
    const data = await graphqlRequest(LINERA_ENDPOINTS.faucet, query, { publicKey });
    console.log('✅ Faucet claim successful:', data);
    return {
      success: true,
      chainId: data.claim.chainId,
      messageId: data.claim.messageId,
      certificateHash: data.claim.certificateHash,
    };
  } catch (error) {
    console.error('❌ Faucet claim failed:', error);
    throw error;
  }
}

/**
 * Query the chain balance
 */
export async function queryChainBalance(chainId) {
  const endpoint = `${LINERA_ENDPOINTS.rpc}/chains/${chainId}`;

  const query = `
    query {
      chain {
        executionState {
          system {
            balance
          }
        }
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, query);
    const balanceAttos = data.chain?.executionState?.system?.balance || '0';
    // Convert from attos (10^18) to tokens
    const balance = parseFloat(balanceAttos) / 1e18;
    return balance;
  } catch (error) {
    console.error('Failed to query balance:', error);
    return 0;
  }
}

/**
 * Query player balance from casino contract
 */
export async function queryPlayerBalance(playerOwner) {
  const endpoint = getApplicationEndpoint();

  const query = `
    query GetPlayerBalance($player: String!) {
      playerBalance(player: $player)
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, query, { player: playerOwner });
    const balanceAttos = data.playerBalance || '0';
    return parseFloat(balanceAttos) / 1e18;
  } catch (error) {
    console.error('Failed to query player balance:', error);
    return 0;
  }
}

/**
 * Execute a deposit operation on the casino contract
 */
export async function executeDeposit(amount, ownerSignature) {
  const endpoint = getApplicationEndpoint();

  // Convert amount to attos
  const amountAttos = Math.floor(amount * 1e18).toString();

  const mutation = `
    mutation Deposit($amount: String!) {
      deposit(amount: $amount) {
        newBalance
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, mutation, { amount: amountAttos });
    console.log('✅ Deposit successful:', data);
    return {
      success: true,
      newBalance: parseFloat(data.deposit.newBalance) / 1e18,
    };
  } catch (error) {
    console.error('❌ Deposit failed:', error);
    throw error;
  }
}

/**
 * Execute a withdrawal operation on the casino contract
 */
export async function executeWithdraw(amount, ownerSignature) {
  const endpoint = getApplicationEndpoint();

  // Convert amount to attos
  const amountAttos = Math.floor(amount * 1e18).toString();

  const mutation = `
    mutation Withdraw($amount: String!) {
      withdraw(amount: $amount) {
        newBalance
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, mutation, { amount: amountAttos });
    console.log('✅ Withdraw successful:', data);
    return {
      success: true,
      newBalance: parseFloat(data.withdraw.newBalance) / 1e18,
    };
  } catch (error) {
    console.error('❌ Withdraw failed:', error);
    throw error;
  }
}

/**
 * Place a bet on the casino contract
 */
export async function executePlaceBet(gameType, betAmount, commitHash, gameParams) {
  const endpoint = getApplicationEndpoint();

  const amountAttos = Math.floor(betAmount * 1e18).toString();

  const mutation = `
    mutation PlaceBet($gameType: GameType!, $betAmount: String!, $commitHash: [Int!]!, $gameParams: String!) {
      placeBet(
        gameType: $gameType
        betAmount: $betAmount
        commitHash: $commitHash
        gameParams: $gameParams
      ) {
        gameId
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, mutation, {
      gameType,
      betAmount: amountAttos,
      commitHash: Array.from(commitHash),
      gameParams: JSON.stringify(gameParams),
    });
    console.log('✅ Bet placed:', data);
    return {
      success: true,
      gameId: data.placeBet.gameId,
    };
  } catch (error) {
    console.error('❌ Place bet failed:', error);
    throw error;
  }
}

/**
 * Reveal the game outcome
 */
export async function executeReveal(gameId, revealValue) {
  const endpoint = getApplicationEndpoint();

  const mutation = `
    mutation Reveal($gameId: Int!, $revealValue: [Int!]!) {
      reveal(gameId: $gameId, revealValue: $revealValue) {
        gameId
        outcome
        payout
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, mutation, {
      gameId,
      revealValue: Array.from(revealValue),
    });
    console.log('✅ Game revealed:', data);
    return {
      success: true,
      gameId: data.reveal.gameId,
      outcome: data.reveal.outcome,
      payout: parseFloat(data.reveal.payout) / 1e18,
    };
  } catch (error) {
    console.error('❌ Reveal failed:', error);
    throw error;
  }
}

/**
 * Query game history
 */
export async function queryGameHistory(limit = 20) {
  const endpoint = getApplicationEndpoint();

  const query = `
    query GetHistory($limit: Int!) {
      gameHistory(limit: $limit) {
        gameId
        gameType
        betAmount
        payoutAmount
        outcomeDetails
        timestamp
      }
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, query, { limit });
    return data.gameHistory || [];
  } catch (error) {
    console.error('Failed to query game history:', error);
    return [];
  }
}

/**
 * Transfer tokens on the chain (for withdrawals to user wallet)
 */
export async function executeTransfer(toChainId, toOwner, amount) {
  const endpoint = getChainEndpoint();

  const amountAttos = Math.floor(amount * 1e18).toString();

  const mutation = `
    mutation Transfer($recipient: Recipient!, $amount: String!) {
      transfer(recipient: $recipient, amount: $amount)
    }
  `;

  try {
    const data = await graphqlRequest(endpoint, mutation, {
      recipient: {
        chain_id: toChainId,
        owner: toOwner,
      },
      amount: amountAttos,
    });
    console.log('✅ Transfer successful:', data);
    return { success: true };
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    throw error;
  }
}

// Export config for use elsewhere
export const LINERA_CONFIG = {
  ...LINERA_ENDPOINTS,
  ...DEPLOYED_CONTRACT,
  getApplicationEndpoint,
  getChainEndpoint,
  getExplorerUrl: (txHash) => `${LINERA_ENDPOINTS.explorer}/chains/${DEPLOYED_CONTRACT.chainId}/block/${txHash}`,
  getChainExplorerUrl: () => `${LINERA_ENDPOINTS.explorer}/chains/${DEPLOYED_CONTRACT.chainId}`,
};

export default {
  claimFromFaucet,
  queryChainBalance,
  queryPlayerBalance,
  executeDeposit,
  executeWithdraw,
  executePlaceBet,
  executeReveal,
  queryGameHistory,
  executeTransfer,
  LINERA_CONFIG,
};
