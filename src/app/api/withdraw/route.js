/**
 * Withdraw API - Processes REAL withdrawals on Linera blockchain
 * Makes actual GraphQL mutations to the casino contract
 *
 * Linera Config loaded from environment variables (.env.local)
 * Explorer: https://explorer.testnet-conway.linera.net
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Linera Configuration - loaded from environment
// NOTE: Application-level GraphQL requires `linera service` running locally.
const LINERA_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || '23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d',
  rpcUrl: process.env.NEXT_PUBLIC_LINERA_RPC || 'http://localhost:8080',
  faucetUrl: process.env.NEXT_PUBLIC_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net',
  explorerUrl: process.env.NEXT_PUBLIC_LINERA_EXPLORER || 'https://explorer.testnet-conway.linera.net',
};

// Withdrawal limits
const MIN_WITHDRAW = 0.001; // Minimum 0.001 LINERA
const MAX_WITHDRAW = 5000;   // Maximum 5000 LINERA

/**
 * Make GraphQL request to Linera node
 * Note: Linera mutations return a block hash string, not a structured response
 */
async function lineraGraphQL(endpoint, query, variables = {}, isMutation = false) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linera GraphQL failed: ${response.status} - ${text}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Linera GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
  }

  // For mutations, Linera returns the block hash as a string
  if (isMutation && typeof result.data === 'string') {
    return { blockHash: result.data, success: true };
  }

  return result.data;
}

/**
 * Get application GraphQL endpoint
 */
function getAppEndpoint() {
  return `${LINERA_CONFIG.rpcUrl}/chains/${LINERA_CONFIG.chainId}/applications/${LINERA_CONFIG.applicationId}`;
}

/**
 * Execute withdrawal on the casino smart contract
 * Contract schema: withdraw(amount: String): Boolean
 * Note: Linera mutations return block hash on success
 */
async function executeContractWithdraw(amount, playerOwner) {
  const endpoint = getAppEndpoint();
  const amountAttos = Math.floor(amount * 1e18).toString();

  console.log(`📝 Executing contract withdrawal: ${amount} LINERA (${amountAttos} attos)`);
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Player: ${playerOwner}`);

  // Call the withdraw mutation on the casino contract
  const mutation = `
    mutation Withdraw($amount: String!) {
      withdraw(amount: $amount)
    }
  `;

  const data = await lineraGraphQL(endpoint, mutation, { amount: amountAttos }, true);
  return data;
}

/**
 * Query player balance from contract
 * Contract schema: playerBalance(owner: String): String
 */
async function queryPlayerBalance(playerOwner) {
  const endpoint = getAppEndpoint();

  const query = `
    query GetBalance($owner: String!) {
      playerBalance(owner: $owner)
    }
  `;

  try {
    const data = await lineraGraphQL(endpoint, query, { owner: playerOwner });
    return parseFloat(data.playerBalance || '0') / 1e18;
  } catch (error) {
    console.error('Failed to query balance:', error);
    return null;
  }
}

/**
 * Validate Linera owner ID format
 */
function isValidLineraOwner(owner) {
  if (!owner || typeof owner !== 'string') return false;
  return /^[0-9a-fA-F]{64}$/.test(owner) || owner.startsWith('0x');
}

export async function POST(request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { userAddress, amount, lineraOwner, chainId } = body;

    const owner = lineraOwner || userAddress;

    console.log('📥 Withdraw request:', { owner: owner?.slice(0, 16) + '...', amount });

    // Validate request
    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Linera owner ID is required' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    const withdrawAmount = parseFloat(amount);

    // Validate amount limits
    if (withdrawAmount < MIN_WITHDRAW) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal is ${MIN_WITHDRAW} LINERA` },
        { status: 400 }
      );
    }

    if (withdrawAmount > MAX_WITHDRAW) {
      return NextResponse.json(
        { success: false, error: `Maximum withdrawal is ${MAX_WITHDRAW} LINERA` },
        { status: 400 }
      );
    }

    // Validate owner format
    if (!isValidLineraOwner(owner)) {
      console.warn('Owner ID format warning:', owner.slice(0, 20) + '...');
    }

    console.log(`💸 Processing Linera withdrawal: ${withdrawAmount} LINERA`);

    // ============================================
    // REAL BLOCKCHAIN TRANSACTION
    // ============================================

    let transactionResult;
    let blockchainSuccess = false;
    let newBalance = null;

    try {
      // First query current balance to verify
      const currentBalance = await queryPlayerBalance(owner);
      console.log(`   Current balance: ${currentBalance} LINERA`);

      if (currentBalance !== null && currentBalance < withdrawAmount) {
        return NextResponse.json(
          { success: false, error: `Insufficient balance. You have ${currentBalance} LINERA` },
          { status: 400 }
        );
      }

      // Execute the actual withdrawal on the contract (returns block hash on success)
      transactionResult = await executeContractWithdraw(withdrawAmount, owner);

      if (!transactionResult.success && !transactionResult.blockHash) {
        throw new Error('Withdraw operation failed on contract');
      }

      blockchainSuccess = true;
      // Note: Contract returns boolean, we estimate new balance
      newBalance = currentBalance !== null ? currentBalance - withdrawAmount : null;

      console.log(`✅ Blockchain withdrawal successful!`);
      console.log(`   Withdrawn: ${withdrawAmount} LINERA`);

    } catch (blockchainError) {
      console.error('❌ Blockchain transaction failed:', blockchainError.message);

      // Return error - don't fake success
      return NextResponse.json({
        success: false,
        error: `Blockchain transaction failed: ${blockchainError.message}`,
        details: {
          endpoint: getAppEndpoint(),
          chainId: LINERA_CONFIG.chainId,
          applicationId: LINERA_CONFIG.applicationId,
        }
      }, { status: 500 });
    }

    // Generate transaction ID from timestamp
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetChainId = chainId || LINERA_CONFIG.chainId;

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      transactionId,
      amount: withdrawAmount,
      newBalance,
      owner,
      chainId: targetChainId,
      applicationId: LINERA_CONFIG.applicationId,
      explorerUrl: `${LINERA_CONFIG.explorerUrl}/chains/${targetChainId}`,
      message: `Successfully withdrew ${withdrawAmount} LINERA`,

      // Blockchain proof
      blockchain: {
        submitted: blockchainSuccess,
        chainId: targetChainId,
        applicationId: LINERA_CONFIG.applicationId,
        endpoint: getAppEndpoint(),
        processingTimeMs: processingTime,
      }
    });

  } catch (error) {
    console.error('❌ Withdrawal error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Withdrawal failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check withdrawal status/limits
export async function GET() {
  // Test connection to Linera node
  let nodeStatus = 'unknown';
  try {
    const response = await fetch(`${LINERA_CONFIG.rpcUrl}/health`, { method: 'GET' });
    nodeStatus = response.ok ? 'connected' : 'error';
  } catch {
    nodeStatus = 'disconnected';
  }

  return NextResponse.json({
    status: 'ok',
    service: 'Linera Withdraw API (REAL BLOCKCHAIN)',
    network: 'Linera Conway Testnet',
    nodeStatus,
    limits: {
      min: MIN_WITHDRAW,
      max: MAX_WITHDRAW,
      currency: 'LINERA',
    },
    config: {
      chainId: LINERA_CONFIG.chainId,
      applicationId: LINERA_CONFIG.applicationId,
      rpcUrl: LINERA_CONFIG.rpcUrl,
      explorerUrl: LINERA_CONFIG.explorerUrl,
      applicationEndpoint: getAppEndpoint(),
    },
  });
}
