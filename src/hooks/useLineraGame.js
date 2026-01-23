/**
 * useLineraGame Hook
 * 
 * Provides easy integration with Linera blockchain for casino games.
 * Handles wallet connection, bet placement, and on-chain outcome generation.
 * 
 * Usage:
 * const { placeBet, isConnected, balance, loading } = useLineraGame();
 * const result = await placeBet('Roulette', 10, { betType: 'color', betValue: 'red' });
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { lineraChainService, GameType } from '@/services/LineraChainService';

export function useLineraGame() {
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState(0);
  const [owner, setOwner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);

  // Initialize and check connection status
  useEffect(() => {
    const init = async () => {
      await lineraChainService.initialize();
      
      if (lineraChainService.isConnected()) {
        setIsConnected(true);
        setBalance(lineraChainService.getBalance());
        setOwner(lineraChainService.owner);
        setChainId(lineraChainService.chainId);
      }
    };

    init();

    // Subscribe to wallet events
    const unsubscribe = lineraChainService.addListener((event, data) => {
      switch (event) {
        case 'connected':
          setIsConnected(true);
          setBalance(data.balance);
          setOwner(data.owner);
          setChainId(data.chainId);
          break;
        case 'disconnected':
          setIsConnected(false);
          setBalance(0);
          setOwner(null);
          setChainId(null);
          break;
        case 'balanceChanged':
          setBalance(data.balance);
          break;
        case 'error':
          setError(data.message || 'Unknown error');
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Connect wallet
   */
  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await lineraChainService.connectWallet();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    lineraChainService.disconnect();
  }, []);

  /**
   * Place a bet on a game
   * @param {string} gameType - 'Roulette', 'Plinko', 'Mines', or 'Wheel'
   * @param {number} betAmount - Amount to bet
   * @param {object} gameParams - Game-specific parameters
   * @returns {Promise<object>} Game result with outcome and payout
   */
  const placeBet = useCallback(async (gameType, betAmount, gameParams = {}) => {
    if (!isConnected) {
      throw new Error('Please connect your Linera wallet first');
    }

    if (betAmount > balance) {
      throw new Error(`Insufficient balance. You have ${balance} LINERA`);
    }

    if (betAmount <= 0) {
      throw new Error('Bet amount must be greater than 0');
    }

    // Validate game type
    const validTypes = Object.values(GameType);
    if (!validTypes.includes(gameType)) {
      throw new Error(`Invalid game type. Must be one of: ${validTypes.join(', ')}`);
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🎰 [useLineraGame] Placing ${gameType} bet: ${betAmount} LINERA`);
      
      const result = await lineraChainService.placeBet(gameType, betAmount, gameParams);
      
      setLastResult(result);
      setBalance(lineraChainService.getBalance());

      // Add to local history
      setGameHistory(prev => [{
        ...result,
        timestamp: Date.now(),
      }, ...prev].slice(0, 50)); // Keep last 50 games

      console.log(`✅ [useLineraGame] Game result:`, result);
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isConnected, balance]);

  /**
   * Play Roulette
   */
  const playRoulette = useCallback(async (betAmount, betType, betValue) => {
    return placeBet(GameType.ROULETTE, betAmount, { betType, betValue });
  }, [placeBet]);

  /**
   * Play Plinko
   */
  const playPlinko = useCallback(async (betAmount, rows = 10, risk = 'medium') => {
    return placeBet(GameType.PLINKO, betAmount, { rows, risk });
  }, [placeBet]);

  /**
   * Play Mines
   */
  const playMines = useCallback(async (betAmount, totalCells = 25, numMines = 5) => {
    return placeBet(GameType.MINES, betAmount, { totalCells, numMines });
  }, [placeBet]);

  /**
   * Play Wheel
   */
  const playWheel = useCallback(async (betAmount, segments = 8) => {
    return placeBet(GameType.WHEEL, betAmount, { segments });
  }, [placeBet]);

  /**
   * Request faucet tokens
   */
  const requestFaucet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await lineraChainService.requestFaucet();
      setBalance(result.newBalance);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch game history from chain
   */
  const fetchHistory = useCallback(async () => {
    try {
      const history = await lineraChainService.getGameHistory();
      setGameHistory(history);
      return history;
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return [];
    }
  }, []);

  return {
    // Connection state
    isConnected,
    connect,
    disconnect,
    
    // Wallet info
    balance,
    owner,
    chainId,
    
    // Game functions
    placeBet,
    playRoulette,
    playPlinko,
    playMines,
    playWheel,
    
    // Faucet
    requestFaucet,
    
    // State
    loading,
    error,
    lastResult,
    
    // History
    gameHistory,
    fetchHistory,
    
    // Constants
    GameType,
    
    // Service reference (for advanced use)
    service: lineraChainService,
    config: lineraChainService.config,
  };
}

export default useLineraGame;
export { GameType };

