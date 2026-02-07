/**
 * Linera Contract/Application Details for Roulette Game
 *
 * Linera Config:
 * - Chain ID: d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd
 * - App ID: 23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d
 * - Explorer: https://explorer.testnet-conway.linera.net
 */

// Linera application IDs
export const lineraChainId = process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd';
export const lineraAppId = process.env.NEXT_PUBLIC_LINERA_APP_ID || '23d04c9fab6a7ac0c8d3896e7128ab17407ac4e4d5bbef58bb2505ae9206594d';
export const lineraExplorerUrl = 'https://explorer.testnet-conway.linera.net';

// Legacy exports for compatibility (deprecated - use Linera IDs above)
export const rouletteContractAddress = lineraAppId;
export const tokenContractAddress = lineraAppId;
export const treasuryAddress = lineraChainId;

// Linera GraphQL schema types for casino operations (no ABI needed - uses GraphQL)
export const LINERA_OPERATIONS = {
  PLACE_BET: 'placeBet',
  SPIN_WHEEL: 'spinWheel',
  CLAIM_WINNINGS: 'claimWinnings',
  GET_BALANCE: 'getBalance',
  GET_GAME_STATE: 'getGameState',
};

// Roulette bet types mapped for Linera
export const ROULETTE_BET_TYPES = {
  STRAIGHT: 0,     // Single number
  COLOR: 1,        // Red/Black
  ODD_EVEN: 2,     // Odd/Even
  HIGH_LOW: 3,     // 1-18 / 19-36
  DOZEN: 4,        // First/Second/Third dozen
  COLUMN: 5,       // First/Second/Third column
  SPLIT: 6,        // Two adjacent numbers
  STREET: 7,       // Three numbers in a row
  CORNER: 8,       // Four numbers in a square
};

// Payout multipliers
export const PAYOUT_MULTIPLIERS = {
  STRAIGHT: 36,    // 35:1
  COLOR: 2,        // 1:1
  ODD_EVEN: 2,     // 1:1
  HIGH_LOW: 2,     // 1:1
  DOZEN: 3,        // 2:1
  COLUMN: 3,       // 2:1
  SPLIT: 18,       // 17:1
  STREET: 12,      // 11:1
  CORNER: 9,       // 8:1
};

// No Ethereum ABI needed - Linera uses GraphQL mutations
export const rouletteABI = [];
export const tokenABI = [];
