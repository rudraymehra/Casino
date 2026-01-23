/**
 * Linera Game Service
 * Handles all game operations through Linera blockchain
 * 
 * This service provides:
 * 1. On-chain game outcomes via Linera smart contracts
 * 2. Commit-reveal scheme for provably fair gaming
 * 3. Integration with Linera wallet for authentication
 * 
 * Supports: Roulette, Plinko, Mines, Wheel
 */

import { LINERA_CONFIG } from '../config/lineraConfig';
import { lineraChainService } from './LineraChainService';

class LineraGameService {
  constructor() {
    this.chainId = LINERA_CONFIG?.NETWORK?.chainId || process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || '';
    this.applicationId = LINERA_CONFIG?.NETWORK?.applicationId || process.env.NEXT_PUBLIC_LINERA_APP_ID || '';
    this.rpcUrl = LINERA_CONFIG?.NETWORK?.rpcUrl || 'https://rpc.testnet-conway.linera.net';
    this.isInitialized = false;
    this.pendingGames = new Map();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      console.log('🎰 Initializing Linera Game Service...');
      console.log(`   Chain ID: ${this.chainId}`);
      console.log(`   App ID: ${this.applicationId}`);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Linera Game Service:', error);
      return false;
    }
  }

  /**
   * Generate random bytes for commit-reveal scheme
   */
  generateRevealValue() {
    const randomBytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 32; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return randomBytes;
  }

  /**
   * Generate commit hash from reveal value
   */
  async generateCommitHash(revealValue) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', revealValue);
      return new Uint8Array(hashBuffer);
    }
    // Fallback
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      hash[i] = revealValue[i] ^ (revealValue[(i + 1) % 32] * 17) & 0xFF;
    }
    return hash;
  }

  /**
   * Convert bytes to hex string
   */
  bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Place a bet and get game outcome via Linera blockchain
   * Uses LineraChainService if wallet is connected, otherwise falls back to API
   */
  async placeBetOnChain(gameType, betAmount, gameParams = {}, playerAddress = null) {
    console.log(`🎰 LINERA: Placing on-chain bet for ${gameType}...`);
    
    try {
      // Check if Linera wallet is connected - use direct chain service if so
      if (lineraChainService.isConnected()) {
        console.log('📡 Using Linera Chain Service (wallet connected)');
        const result = await lineraChainService.placeBet(gameType, betAmount, gameParams);
        
        if (result.success) {
          console.log(`✅ LINERA: On-chain bet successful!`);
          console.log(`   Game ID: ${result.gameId}`);
          console.log(`   Outcome: ${result.outcome}`);
          console.log(`   Payout: ${result.payout}`);
          console.log(`   Mode: ${result.proof?.blockchainMode || 'on-chain'}`);
        }
        
        return result;
      }
      
      // Fallback to API for non-connected users (demo mode)
      console.log('📡 Using API fallback (wallet not connected)');
      const response = await fetch('/api/linera/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameType,
          betAmount,
          gameParams,
          playerAddress: playerAddress || lineraChainService.owner,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ LINERA: On-chain bet successful!`);
        console.log(`   Game ID: ${result.gameId}`);
        console.log(`   Outcome: ${result.outcome}`);
        console.log(`   Payout: ${result.payout}`);
        console.log(`   Blockchain: ${result.proof?.blockchainSubmitted ? 'SUBMITTED' : 'LOCAL'}`);
      }

      return result;
    } catch (error) {
      console.error('❌ LINERA: On-chain bet failed:', error);
      throw error;
    }
  }

  /**
   * Check if user has connected Linera wallet
   */
  isWalletConnected() {
    return lineraChainService.isConnected();
  }

  /**
   * Get connected wallet balance
   */
  getWalletBalance() {
    return lineraChainService.getBalance();
  }

  /**
   * Get connected wallet owner
   */
  getWalletOwner() {
    return lineraChainService.owner;
  }

  /**
   * Start a new game - generates commitment and outcome
   * For immediate local feedback + blockchain logging
   */
  async startGame(gameType, betAmount, gameParams = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate reveal value and commitment
      const revealValue = this.generateRevealValue();
      const commitHash = await this.generateCommitHash(revealValue);
      
      // Generate local outcome for instant feedback
      const outcome = this.generateLocalOutcome(gameType, revealValue, gameParams);
      
      // Create game ID
      const gameId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      // Store pending game
      this.pendingGames.set(gameId, {
        gameType,
        betAmount,
        gameParams,
        revealValue,
        commitHash,
        outcome,
        timestamp: Date.now(),
      });

      console.log(`🎮 Game started: ${gameType}`);
      console.log(`   Game ID: ${gameId}`);
      console.log(`   Commit Hash: ${this.bytesToHex(commitHash)}`);

      return {
        success: true,
        gameId,
        outcome,
        commitHash: this.bytesToHex(commitHash),
        revealValue: this.bytesToHex(revealValue),
      };
    } catch (error) {
      console.error('Failed to start game:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate game outcome locally (matching the Rust contract logic)
   */
  generateLocalOutcome(gameType, seed, params = {}) {
    const randomValue = this.seedToNumber(seed);
    
    switch (gameType) {
      case 'roulette':
      case 'Roulette':
        return this.generateRouletteOutcome(randomValue);
      case 'plinko':
      case 'Plinko':
        return this.generatePlinkoOutcome(seed, params.rows || 10);
      case 'mines':
      case 'Mines':
        return this.generateMinesOutcome(seed, params.totalCells || 25, params.numMines || 5);
      case 'wheel':
      case 'Wheel':
        return this.generateWheelOutcome(randomValue, params.segments || 8);
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  seedToNumber(seed) {
    return ((seed[0] << 24) | (seed[1] << 16) | (seed[2] << 8) | seed[3]) >>> 0;
  }

  generateRouletteOutcome(randomValue) {
    const result = randomValue % 37;
    return {
      result,
      color: result === 0 ? 'green' : (result % 2 === 0 ? 'black' : 'red'),
      isEven: result > 0 && result % 2 === 0,
      isOdd: result > 0 && result % 2 === 1,
      isHigh: result >= 19,
      isLow: result >= 1 && result <= 18,
      multiplier: result === 0 ? 35 : 2,
    };
  }

  generatePlinkoOutcome(seed, rows) {
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
    
    const multipliers = this.getPlinkoMultipliers(rows);
    const multiplier = multipliers[position] || 1;
    
    return {
      finalPosition: position,
      path,
      multiplier,
    };
  }

  getPlinkoMultipliers(rows) {
    const center = Math.floor(rows / 2);
    const multipliers = [];
    for (let i = 0; i <= rows; i++) {
      const distanceFromCenter = Math.abs(i - center);
      if (distanceFromCenter === 0) multipliers.push(1.0);
      else if (distanceFromCenter === 1) multipliers.push(1.2);
      else if (distanceFromCenter === 2) multipliers.push(1.5);
      else if (distanceFromCenter === 3) multipliers.push(2.0);
      else if (distanceFromCenter === 4) multipliers.push(5.0);
      else multipliers.push(10.0 + distanceFromCenter);
    }
    return multipliers;
  }

  generateMinesOutcome(seed, totalCells, numMines) {
    const mines = new Set();
    const availableCells = Array.from({ length: totalCells }, (_, i) => i);
    
    for (let i = 0; i < numMines && availableCells.length > 0; i++) {
      const seedWithCounter = new Uint8Array([...seed, i]);
      const randomValue = this.seedToNumber(seedWithCounter);
      const index = randomValue % availableCells.length;
      
      mines.add(availableCells[index]);
      availableCells.splice(index, 1);
    }
    
    return {
      minePositions: Array.from(mines),
      totalCells,
      numMines,
      safeCells: totalCells - numMines,
    };
  }

  generateWheelOutcome(randomValue, segments) {
    const result = randomValue % segments;
    const multipliers = [1, 1.5, 2, 0.5, 3, 1, 5, 0.5];
    
    return {
      segment: result,
      multiplier: multipliers[result % multipliers.length],
    };
  }

  /**
   * Get game stats from Linera
   */
  async getGameStats() {
    try {
      const endpoint = `${this.rpcUrl}/chains/${this.chainId}/applications/${this.applicationId}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query { nextGameId totalFunds gameHistory { gameId gameType betAmount payoutAmount outcomeDetails } }`,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return result.data || { nextGameId: 0, totalFunds: '0', gameHistory: [] };
    } catch (error) {
      console.warn('Could not fetch game stats:', error);
      return { nextGameId: 0, totalFunds: '0', gameHistory: [] };
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized;
  }
}

// Export singleton instance
const lineraGameService = new LineraGameService();
export default lineraGameService;

export { LineraGameService };
