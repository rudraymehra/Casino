/**
 * Linera Faucet API - Claims REAL tokens from Linera testnet faucet
 * Creates a new chain with tokens for the user
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Linera Faucet Configuration
const LINERA_CONFIG = {
  faucetUrl: process.env.NEXT_PUBLIC_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net',
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
  defaultAmount: 100, // Faucet gives 100 LINERA per claim (testnet)
};

/**
 * Make GraphQL request to Linera faucet
 */
async function faucetGraphQL(query, variables = {}) {
  console.log(`🚰 Faucet request to: ${LINERA_CONFIG.faucetUrl}`);

  const response = await fetch(LINERA_CONFIG.faucetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Faucet request failed: ${response.status} - ${text}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Faucet error: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

/**
 * Generate a new Ed25519 key pair for wallet creation.
 * Linera uses Ed25519 keys. Node.js crypto supports Ed25519 natively since v15.
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Ed25519 SPKI DER public key: last 32 bytes are the raw public key
  const rawPublicKey = publicKey.subarray(publicKey.length - 32);
  // Ed25519 PKCS8 DER private key: last 32 bytes are the raw seed (private key)
  const rawPrivateKey = privateKey.subarray(privateKey.length - 32);

  return {
    privateKey: rawPrivateKey.toString('hex'),
    publicKey: rawPublicKey.toString('hex'),
  };
}

/**
 * Claim a new chain from the Linera faucet
 * Owner format: 0x + 64 hex characters (Address32)
 */
async function claimFromFaucet(owner) {
  // Ensure owner has correct format: 0x + 64 hex chars
  let formattedOwner = owner;
  if (!formattedOwner.startsWith('0x')) {
    formattedOwner = '0x' + formattedOwner;
  }
  // Pad to 64 hex chars if needed
  if (formattedOwner.length < 66) {
    formattedOwner = '0x' + formattedOwner.replace('0x', '').padStart(64, '0');
  }

  console.log(`🚰 Claiming from Linera faucet for owner: ${formattedOwner.slice(0, 16)}...`);

  // The Linera faucet claim mutation - owner is an AccountOwner scalar
  const mutation = `
    mutation {
      claim(owner: "${formattedOwner}")
    }
  `;

  const data = await faucetGraphQL(mutation);

  // Response contains chain description with origin info
  const claim = data.claim;

  // Extract chain ID from origin - it's a child chain
  let chainId = null;
  if (claim.origin?.Child) {
    // For child chains, we need to compute the chain ID
    // The parent chain ID is given, along with block_height and chain_index
    chainId = `${claim.origin.Child.parent}:${claim.origin.Child.block_height}:${claim.origin.Child.chain_index}`;
  }

  return {
    origin: claim.origin,
    timestamp: claim.timestamp,
    balance: claim.config?.balance,
    chainId,
    owner: formattedOwner,
  };
}

/**
 * Query faucet version/status
 */
async function queryFaucetStatus() {
  const query = `
    query {
      version
    }
  `;

  try {
    const data = await faucetGraphQL(query);
    return { available: true, version: data.version };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

export async function POST(request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { publicKey, createNewWallet } = body;

    console.log('🚰 Faucet claim request received');

    let userPublicKey = publicKey;
    let newKeyPair = null;

    // If no public key provided or createNewWallet is true, generate new key pair
    if (!userPublicKey || createNewWallet) {
      console.log('📝 Generating new key pair...');
      newKeyPair = generateKeyPair();
      userPublicKey = newKeyPair.publicKey;
      console.log(`   New public key: ${userPublicKey.slice(0, 16)}...`);
    }

    // ============================================
    // REAL FAUCET CLAIM
    // ============================================

    let claimResult;
    let blockchainSuccess = false;

    try {
      claimResult = await claimFromFaucet(userPublicKey);
      blockchainSuccess = true;

      console.log('✅ Faucet claim successful!');
      console.log(`   Chain origin: ${JSON.stringify(claimResult.origin)}`);
      console.log(`   Balance: ${claimResult.balance} LINERA`);
      console.log(`   Owner: ${claimResult.owner?.slice(0, 16)}...`);

    } catch (faucetError) {
      console.error('❌ Faucet claim failed:', faucetError.message);

      return NextResponse.json({
        success: false,
        error: `Faucet claim failed: ${faucetError.message}`,
        details: {
          faucetUrl: LINERA_CONFIG.faucetUrl,
          publicKey: userPublicKey?.slice(0, 16) + '...',
        }
      }, { status: 500 });
    }

    const processingTime = Date.now() - startTime;

    // Parse balance from response (e.g., "100." -> 100)
    const claimedAmount = parseFloat(claimResult.balance) || LINERA_CONFIG.defaultAmount;

    // Build response
    const response = {
      success: true,
      amount: claimedAmount,
      currency: 'LINERA',

      // Chain info from faucet
      chainId: claimResult.chainId,
      origin: claimResult.origin,
      owner: claimResult.owner,

      // New wallet info (only if we created one)
      // SECURITY: This MUST be over HTTPS in production
      // Client MUST encrypt this key immediately with user's password
      newWallet: newKeyPair ? {
        publicKey: newKeyPair.publicKey,
        privateKey: newKeyPair.privateKey,
        owner: `0x${newKeyPair.publicKey}`,
        security: {
          warning: 'CRITICAL: Encrypt this private key immediately with user password!',
          requiresHttps: true,
          mustEncryptImmediately: true,
        },
      } : null,

      // Explorer links
      explorerUrl: `${LINERA_CONFIG.explorerUrl}`,

      // Metadata
      blockchain: {
        submitted: blockchainSuccess,
        faucetUrl: LINERA_CONFIG.faucetUrl,
        processingTimeMs: processingTime,
      },

      message: `Successfully claimed ${claimedAmount} LINERA from faucet`,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Faucet API error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Faucet request failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check faucet status
export async function GET() {
  const status = await queryFaucetStatus();

  return NextResponse.json({
    status: status.available ? 'ok' : 'error',
    service: 'Linera Faucet API (REAL BLOCKCHAIN)',
    network: 'Linera Conway Testnet',
    faucetStatus: status,
    config: {
      faucetUrl: LINERA_CONFIG.faucetUrl,
      explorerUrl: LINERA_CONFIG.explorerUrl,
      defaultAmount: LINERA_CONFIG.defaultAmount,
    },
    usage: {
      method: 'POST',
      body: {
        publicKey: '(optional) Your Linera public key',
        createNewWallet: '(optional) Set true to generate new key pair',
      },
    },
  });
}
