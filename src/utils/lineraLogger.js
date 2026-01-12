/**
 * Linera Game Logger Utility
 * Clean implementation for logging game results to Linera blockchain
 */

import { LINERA_CONFIG } from '../config/lineraConfig';

/**
 * Log game result to Linera blockchain
 */
export async function logGameResultToLinera(gameData) {
  try {
    const response = await fetch('/api/log-to-linera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to log to Linera:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log complete game result with all metadata
 */
export async function logCompleteGameResult(gameType, gameResult, betAmount, payout, playerAddress) {
  const gameData = {
    gameType,
    gameResult,
    betAmount,
    payout,
    playerAddress: playerAddress || 'anonymous',
    timestamp: Date.now(),
    chainId: LINERA_CONFIG.NETWORK.chainId,
  };

  return logGameResultToLinera(gameData);
}

export default {
  logGameResultToLinera,
  logCompleteGameResult,
};
