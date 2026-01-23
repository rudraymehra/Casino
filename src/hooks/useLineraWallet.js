/**
 * Linera Wallet React Hooks - Production Implementation
 *
 * Integrates with Croissant wallet extension (window.linera)
 * Reference: https://github.com/Nirajsah/croissant
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { lineraChainService, LINERA_CONFIG, GameType } from '../services/LineraChainService';

/**
 * Main wallet connection hook
 */
export function useLineraWallet() {
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [owner, setOwner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState(null);
  const listenerRef = useRef(null);

  // Check wallet installation and existing connection on mount
  useEffect(() => {
    const init = async () => {
      const installed = await lineraChainService.initialize();
      setIsWalletInstalled(installed);

      if (installed && lineraChainService.checkConnection()) {
        const info = lineraChainService.getConnectionInfo();
        setIsConnected(true);
        setOwner(info.owner);
        setChainId(info.chainId);
        setBalance(info.balance);
      }
    };

    init();

    // Listen for wallet events
    const handleEvent = (event, data) => {
      switch (event) {
        case 'connected':
          setIsConnected(true);
          setOwner(data.owner);
          setChainId(data.chainId);
          setBalance(data.balance || 0);
          setError(null);
          break;
        case 'disconnected':
          setIsConnected(false);
          setOwner(null);
          setChainId(null);
          setBalance(0);
          break;
        case 'balanceChanged':
          setBalance(data.balance);
          break;
        case 'error':
          setError(data?.message || 'Unknown error');
          break;
      }
    };

    listenerRef.current = lineraChainService.addListener(handleEvent);

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
      }
    };
  }, []);

  /**
   * Connect wallet - requests user approval via extension popup
   */
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await lineraChainService.connectWallet();

      setIsConnected(true);
      setOwner(result.owner);
      setChainId(result.chainId);
      setBalance(result.balance);

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    lineraChainService.disconnect();
    setIsConnected(false);
    setOwner(null);
    setChainId(null);
    setBalance(0);
  }, []);

  /**
   * Refresh balance from chain
   */
  const refreshBalance = useCallback(async () => {
    try {
      const newBalance = await lineraChainService.getBalance();
      setBalance(newBalance);
      return newBalance;
    } catch (err) {
      console.error('Failed to refresh balance:', err);
      return balance;
    }
  }, [balance]);

  /**
   * Deposit funds into casino
   */
  const deposit = useCallback(async (amount) => {
    try {
      const result = await lineraChainService.deposit(amount);
      await refreshBalance();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshBalance]);

  /**
   * Withdraw funds from casino
   */
  const withdraw = useCallback(async (amount) => {
    try {
      const result = await lineraChainService.withdraw(amount);
      await refreshBalance();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshBalance]);

  /**
   * Request faucet tokens (for testing)
   */
  const requestFaucet = useCallback(async (amount = 100) => {
    try {
      const result = await lineraChainService.requestFaucet(amount);
      setBalance(result.newBalance);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    // Wallet state
    isWalletInstalled,
    isConnected,
    isConnecting,
    owner,
    chainId,
    balance,
    error,

    // Actions
    connect,
    disconnect,
    refreshBalance,
    deposit,
    withdraw,
    requestFaucet,

    // Helpers
    walletInstallUrl: lineraChainService.getWalletInstallUrl(),
    config: LINERA_CONFIG,
  };
}

/**
 * Game operations hook
 */
export function useLineraGame() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Place a bet and play a game
   */
  const playGame = useCallback(async (gameType, betAmount, gameParams = {}) => {
    setIsPlaying(true);
    setError(null);
    setLastResult(null);

    try {
      console.log(`Playing ${gameType} with ${betAmount} LINERA...`);

      const result = await lineraChainService.placeBet(gameType, betAmount, gameParams);

      setLastResult(result);
      setCurrentGame({
        gameId: result.gameId,
        gameType,
        betAmount,
        outcome: result.outcome,
        payout: result.payout,
        multiplier: result.multiplier,
        proof: result.proof,
      });

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsPlaying(false);
    }
  }, []);

  /**
   * Reset game state
   */
  const resetGame = useCallback(() => {
    setCurrentGame(null);
    setLastResult(null);
    setError(null);
  }, []);

  return {
    isPlaying,
    currentGame,
    lastResult,
    error,
    playGame,
    resetGame,
    GameType,
  };
}

/**
 * Game history hook
 */
export function useLineraHistory() {
  const [gameHistory, setGameHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch game history from chain
   */
  const fetchHistory = useCallback(async (limit = 20) => {
    setIsLoading(true);
    setError(null);

    try {
      const history = await lineraChainService.getGameHistory(limit);
      setGameHistory(history);
      return history;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount if connected
  useEffect(() => {
    if (lineraChainService.checkConnection()) {
      fetchHistory();
    }
  }, [fetchHistory]);

  return {
    gameHistory,
    isLoading,
    error,
    refetch: fetchHistory,
  };
}

export { LINERA_CONFIG, GameType };
