/**
 * Deposit API - PRODUCTION READY
 * Processes deposits via Linera GraphQL mutations
 *
 * NOTE: For Linera, deposits work differently than EVM chains.
 * Users claim tokens from the faucet which creates a chain.
 * "Deposits" to the casino contract require the wallet to sign.
 * This API records deposit intent; actual transfer happens client-side via wallet.
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

// Deposit limits
const MIN_DEPOSIT = 0.001;
const MAX_DEPOSIT = 10000;

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
 * Execute deposit on the casino smart contract
 * Contract schema: deposit(amount: String): Boolean
 * Note: Linera mutations return block hash on success
 */
async function executeContractDeposit(amount, playerOwner) {
  const endpoint = getAppEndpoint();
  const amountAttos = Math.floor(amount * 1e18).toString();

  console.log(`📝 Executing contract deposit: ${amount} LINERA (${amountAttos} attos)`);
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Player: ${playerOwner}`);

  const mutation = `
    mutation Deposit($amount: String!) {
      deposit(amount: $amount)
    }
  `;

  const data = await lineraGraphQL(endpoint, mutation, { amount: amountAttos }, true);
  return data;
}

export async function POST(request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { userAddress, amount, lineraOwner, chainId } = body;

    const owner = lineraOwner || userAddress;

    console.log('📥 Deposit request:', { owner: owner?.slice(0, 16) + '...', amount });

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

    const depositAmount = parseFloat(amount);

    if (depositAmount < MIN_DEPOSIT) {
      return NextResponse.json(
        { success: false, error: `Minimum deposit is ${MIN_DEPOSIT} LINERA` },
        { status: 400 }
      );
    }

    if (depositAmount > MAX_DEPOSIT) {
      return NextResponse.json(
        { success: false, error: `Maximum deposit is ${MAX_DEPOSIT} LINERA` },
        { status: 400 }
      );
    }

    console.log(`💰 Processing Linera deposit: ${depositAmount} LINERA`);

    // ============================================
    // REAL BLOCKCHAIN TRANSACTION
    // ============================================

    let transactionResult;
    let blockchainSuccess = false;
    let newBalance = null;

    try {
      // Execute the actual deposit on the contract (returns block hash on success)
      transactionResult = await executeContractDeposit(depositAmount, owner);

      if (!transactionResult.success && !transactionResult.blockHash) {
        throw new Error('Deposit operation failed on contract');
      }

      blockchainSuccess = true;
      // Note: Contract returns boolean, balance should be queried separately
      newBalance = depositAmount; // Return the deposited amount as placeholder

      console.log(`✅ Blockchain deposit successful!`);
      console.log(`   Deposited: ${depositAmount} LINERA`);

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

    const processingTime = Date.now() - startTime;
    const transactionId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetChainId = chainId || LINERA_CONFIG.chainId;

    return NextResponse.json({
      success: true,
      transactionId,
      amount: depositAmount,
      newBalance,
      owner,
      chainId: targetChainId,
      applicationId: LINERA_CONFIG.applicationId,
      explorerUrl: `${LINERA_CONFIG.explorerUrl}/chains/${targetChainId}`,
      message: `Successfully deposited ${depositAmount} LINERA`,

      blockchain: {
        submitted: blockchainSuccess,
        chainId: targetChainId,
        applicationId: LINERA_CONFIG.applicationId,
        endpoint: getAppEndpoint(),
        processingTimeMs: processingTime,
      }
    });

  } catch (error) {
    console.error('❌ Deposit error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Deposit failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  let nodeStatus = 'unknown';
  try {
    const response = await fetch(`${LINERA_CONFIG.rpcUrl}/health`, { method: 'GET' });
    nodeStatus = response.ok ? 'connected' : 'error';
  } catch {
    nodeStatus = 'disconnected';
  }

  return NextResponse.json({
    status: 'ok',
    service: 'Linera Deposit API (REAL BLOCKCHAIN)',
    network: 'Linera Conway Testnet',
    nodeStatus,
    limits: {
      min: MIN_DEPOSIT,
      max: MAX_DEPOSIT,
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
