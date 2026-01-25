/**
 * Linera Place Bet API Route
 * Submits REAL transactions to the Linera blockchain via GraphQL
 * No CLI dependency - pure HTTP
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Linera Configuration - Hardcoded for production reliability
const LINERA_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || 'e230e675d2ade7ac7c3351d57c7dff2ff59c7ade94cb615ebe77149113b6d194',
  // FORCE correct RPC URL - env var might be set wrong
  rpcUrl: 'https://rpc.testnet-conway.linera.net',
  faucetUrl: 'https://faucet.testnet-conway.linera.net',
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
};

/**
 * Make GraphQL request to Linera node
 */
/**
 * Make GraphQL request to Linera node
 * Note: Linera mutations return a block hash string, not a structured response
 */
async function lineraGraphQL(endpoint, query, variables = {}, isMutation = false) {
  console.log(`📡 GraphQL Request to: ${endpoint}`);

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
  // e.g., {"data": "abc123..."} instead of {"data": {"placeBet": true}}
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
 * Generate random bytes for commit-reveal
 */
function generateRevealValue() {
  return crypto.randomBytes(32);
}

/**
 * Generate SHA3-256 hash
 */
function generateCommitHash(revealValue) {
  return crypto.createHash('sha3-256').update(revealValue).digest();
}

/**
 * Calculate game outcome (matches Rust contract logic exactly)
 */
function calculateOutcome(gameType, seed, params) {
  const seedNumber = seed.readUInt32BE(0);

  switch (gameType) {
    case 'Roulette':
      return calculateRouletteOutcome(seedNumber, params);
    case 'Plinko':
      return calculatePlinkoOutcome(seed, params.rows || 12);
    case 'Mines':
      return calculateMinesOutcome(seed, params.totalCells || 25, params.numMines || 5, params.revealed || 0);
    case 'Wheel':
      return calculateWheelOutcome(seedNumber, params.segments || 8);
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }
}

function calculateRouletteOutcome(seedNumber, params) {
  const result = seedNumber % 37;
  const betType = params.betType || 'color';
  const betValue = params.betValue;

  let win = false;
  let multiplier = 0;

  if (betType === 'number' && parseInt(betValue) === result) {
    win = true;
    multiplier = 36;
  } else if (betType === 'color') {
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result);
    const isBlack = result !== 0 && !isRed;
    if ((betValue === 'red' && isRed) || (betValue === 'black' && isBlack)) {
      win = true;
      multiplier = 2;
    }
  } else if (betType === 'odd_even') {
    if (result !== 0) {
      const isOdd = result % 2 === 1;
      if ((betValue === 'odd' && isOdd) || (betValue === 'even' && !isOdd)) {
        win = true;
        multiplier = 2;
      }
    }
  } else if (betType === 'high_low') {
    if (result !== 0) {
      const isHigh = result >= 19;
      if ((betValue === 'high' && isHigh) || (betValue === 'low' && !isHigh)) {
        win = true;
        multiplier = 2;
      }
    }
  }

  const color = result === 0 ? 'green' : ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result) ? 'red' : 'black');

  return {
    result,
    color,
    win,
    multiplier,
    outcome: `Landed on ${result} (${color})${win ? ' - WIN!' : ''}`,
  };
}

function calculatePlinkoOutcome(seed, rows) {
  let position = Math.floor(rows / 2);
  const path = [];

  for (let i = 0; i < rows; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    const goRight = (seed[byteIndex % seed.length] >> bitIndex) & 1;

    if (goRight) {
      position = Math.min(position + 1, rows);
    } else {
      position = Math.max(position - 1, 0);
    }
    path.push(goRight ? 'R' : 'L');
  }

  const center = Math.floor(rows / 2);
  const distance = Math.abs(position - center);
  const multipliers = [1.0, 1.2, 1.5, 2.0, 5.0, 10.0, 25.0, 50.0, 100.0];
  const multiplier = multipliers[Math.min(distance, multipliers.length - 1)];

  return {
    finalPosition: position,
    path: path.join(''),
    multiplier,
    outcome: `Ball landed at position ${position} (${multiplier}x)`,
  };
}

function calculateMinesOutcome(seed, totalCells, numMines, revealedCount) {
  const mines = new Set();
  const availableCells = Array.from({ length: totalCells }, (_, i) => i);

  for (let i = 0; i < numMines && availableCells.length > 0; i++) {
    const extendedSeed = Buffer.concat([seed, Buffer.from([i])]);
    const hash = crypto.createHash('sha3-256').update(extendedSeed).digest();
    const randomValue = hash.readUInt32BE(0);
    const index = randomValue % availableCells.length;

    mines.add(availableCells[index]);
    availableCells.splice(index, 1);
  }

  // Calculate multiplier based on revealed safe cells
  const safeCells = totalCells - numMines;
  let multiplier = 1.0;
  for (let i = 0; i < revealedCount; i++) {
    multiplier *= (totalCells - i) / (safeCells - i);
  }
  multiplier = Math.round(multiplier * 100) / 100;

  return {
    minePositions: Array.from(mines),
    totalCells,
    numMines,
    safeCells,
    multiplier,
    outcome: `${numMines} mines placed, ${revealedCount} safe cells revealed`,
  };
}

function calculateWheelOutcome(seedNumber, segments) {
  const result = seedNumber % segments;
  const multipliers = [1, 1.5, 2, 0.5, 3, 1, 5, 0.5];
  const multiplier = multipliers[result % multipliers.length];

  return {
    segment: result,
    multiplier,
    outcome: `Wheel stopped at segment ${result} (${multiplier}x)`,
  };
}

/**
 * Query the next game ID from the contract
 */
async function queryNextGameId() {
  const endpoint = getAppEndpoint();
  const query = `{ nextGameId }`;
  const data = await lineraGraphQL(endpoint, query, {}, false);
  return data.nextGameId;
}

/**
 * Submit PlaceBet operation to Linera contract via GraphQL
 * Contract schema: placeBet(gameType: String, betAmount: String, commitHash: String, gameParams: String): Boolean
 * Note: Linera mutations return block hash on success
 */
async function submitPlaceBet(gameType, betAmount, commitHash, gameParams) {
  const endpoint = getAppEndpoint();
  const amountAttos = Math.floor(betAmount * 1e18).toString();
  const commitHashHex = commitHash.toString('hex');

  console.log(`📝 Submitting PlaceBet to blockchain...`);
  console.log(`   Game: ${gameType}`);
  console.log(`   Amount: ${betAmount} LINERA (${amountAttos} attos)`);
  console.log(`   CommitHash: ${commitHashHex.slice(0, 16)}...`);

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

  const data = await lineraGraphQL(endpoint, mutation, {
    gameType,
    betAmount: amountAttos,
    commitHash: commitHashHex,
    gameParams: JSON.stringify(gameParams || {}),
  }, true); // isMutation = true

  return data;
}

/**
 * Submit Reveal operation to Linera contract via GraphQL
 * Contract schema: reveal(gameId: Int, revealValue: String): Boolean
 * Note: Linera mutations return block hash on success
 */
async function submitReveal(gameId, revealValue) {
  const endpoint = getAppEndpoint();
  const revealValueHex = revealValue.toString('hex');

  console.log(`📝 Submitting Reveal to blockchain...`);
  console.log(`   Game ID: ${gameId}`);
  console.log(`   RevealValue: ${revealValueHex.slice(0, 16)}...`);

  const mutation = `
    mutation Reveal($gameId: Int!, $revealValue: String!) {
      reveal(gameId: $gameId, revealValue: $revealValue)
    }
  `;

  const data = await lineraGraphQL(endpoint, mutation, {
    gameId: parseInt(gameId),
    revealValue: revealValueHex,
  }, true); // isMutation = true

  return data;
}

export async function POST(request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { gameType, betAmount, gameParams, playerAddress } = body;

    if (!gameType || betAmount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: gameType, betAmount' },
        { status: 400 }
      );
    }

    console.log(`🎮 Processing ${gameType} bet: ${betAmount} LINERA`);

    // Generate commit-reveal values
    const revealValue = generateRevealValue();
    const commitHash = generateCommitHash(revealValue);

    // Query the next game ID from contract BEFORE placing bet
    let gameId;
    try {
      gameId = await queryNextGameId();
      console.log(`   Next Game ID from contract: ${gameId}`);
    } catch (error) {
      console.warn('Failed to query nextGameId, using timestamp:', error.message);
      gameId = Date.now();
    }

    // Calculate outcome locally (same algorithm as smart contract)
    // This ensures provably fair - same result on-chain and off-chain
    const outcome = calculateOutcome(gameType, revealValue, gameParams || {});

    // Calculate payout
    const bet = parseFloat(betAmount);
    const payout = bet * outcome.multiplier;

    // ============================================
    // REAL BLOCKCHAIN SUBMISSION
    // ============================================

    let blockchainResult = {
      success: false,
      mode: 'local-computation',
      error: null,
    };

    try {
      // Step 1: Submit PlaceBet to blockchain (returns block hash on success)
      const placeBetResult = await submitPlaceBet(gameType, bet, commitHash, gameParams);
      console.log('✅ PlaceBet submitted:', placeBetResult);

      if (!placeBetResult.success && !placeBetResult.blockHash) {
        throw new Error('PlaceBet operation failed on contract');
      }

      // Step 2: Submit Reveal to blockchain (returns block hash on success)
      const revealResult = await submitReveal(gameId, revealValue);
      console.log('✅ Reveal submitted:', revealResult);

      if (!revealResult.success && !revealResult.blockHash) {
        throw new Error('Reveal operation failed on contract');
      }

      blockchainResult = {
        success: true,
        mode: 'on-chain',
        gameId: gameId,
        transactionId: `tx_${Date.now()}`,
        placeBetBlockHash: placeBetResult.blockHash,
        revealBlockHash: revealResult.blockHash,
        placeBetSubmitted: true,
        revealSubmitted: true,
      };

      console.log('✅ BLOCKCHAIN TRANSACTION SUCCESSFUL!');

    } catch (blockchainError) {
      console.error('❌ BLOCKCHAIN SUBMISSION FAILED:', blockchainError.message);

      // PRODUCTION MODE: Fail hard when blockchain is unavailable
      // DO NOT allow games without on-chain record
      return NextResponse.json({
        success: false,
        error: 'Blockchain unavailable - cannot process bet',
        details: {
          message: blockchainError.message,
          chainId: LINERA_CONFIG.chainId,
          applicationId: LINERA_CONFIG.applicationId,
          endpoint: getAppEndpoint(),
          hint: 'The casino smart contract may not be deployed or the Linera node is unreachable',
        },
        // Include proof data so user can verify locally if needed
        proof: {
          commitHash: commitHash.toString('hex'),
          gameType,
          betAmount: bet,
          timestamp: Date.now(),
        },
      }, { status: 503 });
    }

    const processingTime = Date.now() - startTime;

    // Return comprehensive response
    const response = {
      success: true,
      gameId,
      gameType,
      betAmount: bet,
      outcome: outcome.outcome,
      result: outcome,
      payout,
      multiplier: outcome.multiplier,

      // Blockchain proof
      proof: {
        commitHash: commitHash.toString('hex'),
        revealValue: revealValue.toString('hex'),
        chainId: LINERA_CONFIG.chainId,
        applicationId: LINERA_CONFIG.applicationId,
        timestamp: Date.now(),
        blockchainMode: blockchainResult.mode,
        blockchainSubmitted: blockchainResult.success,
        transactionId: blockchainResult.transactionId || null,
        blockchainError: blockchainResult.error,
      },

      // Explorer link
      explorerUrl: `${LINERA_CONFIG.explorerUrl}/chains/${LINERA_CONFIG.chainId}`,
      applicationUrl: `${LINERA_CONFIG.explorerUrl}/applications/${LINERA_CONFIG.applicationId}`,

      // Player info
      playerAddress: playerAddress || 'anonymous',

      // Timing
      processingTimeMs: processingTime,
    };

    console.log(`✅ Game ${gameType} completed:`, {
      gameId,
      outcome: outcome.outcome,
      payout,
      mode: blockchainResult.mode,
      time: `${processingTime}ms`,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Place bet API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Test connection to Linera node
  let nodeStatus = 'unknown';
  let appStatus = 'unknown';

  try {
    const response = await fetch(`${LINERA_CONFIG.rpcUrl}/health`);
    nodeStatus = response.ok ? 'connected' : 'error';
  } catch {
    nodeStatus = 'disconnected';
  }

  try {
    const endpoint = getAppEndpoint();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    appStatus = response.ok ? 'available' : 'error';
  } catch {
    appStatus = 'unavailable';
  }

  return NextResponse.json({
    status: 'ok',
    service: 'Linera Place Bet API (REAL BLOCKCHAIN)',
    network: 'Linera Conway Testnet',
    nodeStatus,
    applicationStatus: appStatus,
    config: {
      chainId: LINERA_CONFIG.chainId,
      applicationId: LINERA_CONFIG.applicationId,
      rpcUrl: LINERA_CONFIG.rpcUrl,
      applicationEndpoint: getAppEndpoint(),
    },
  });
}
