/**
 * Linera Wallet React Hooks
 * Provides wallet connection, balance tracking, and game operations
 * 
 * Now supports both:
 * 1. LineraWalletService (MetaMask/CheCko bridge)
 * 2. LineraChainService (direct @linera/client SDK)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { lineraWalletService, GAME_TYPES, LINERA_CONFIG } from '../services/LineraWalletService';
import { lineraChainService } from '../services/LineraChainService';

/**
 * Main wallet connection hook
 */
export function useLineraWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [owner, setOwner] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState(null);
  const listenerRef = useRef(null);

  useEffect(() => {
    const handleEvent = (event, data) => {
      switch (event) {
        case 'connected':
          setIsConnected(true);
          setOwner(data.owner);
          setAddress(data.address);
          setChainId(data.chain);
          setBalance(data.balance || 0);
          setError(null);
          break;
        case 'disconnected':
          setIsConnected(false);
          setOwner(null);
          setAddress(null);
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

    listenerRef.current = lineraWalletService.addListener(handleEvent);
    
    // Check if already connected
    if (lineraWalletService.isConnected()) {
      setIsConnected(true);
      setOwner(lineraWalletService.userOwner);
      setAddress(lineraWalletService.userAddress);
      setChainId(lineraWalletService.connectedChain);
      setBalance(lineraWalletService.getBalance());
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
      }
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await lineraWalletService.connect();
      setIsConnected(true);
      setOwner(result.owner);
      setAddress(result.ethAddress);
      setChainId(result.chain);
      setBalance(result.balance);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await lineraWalletService.disconnect();
    setIsConnected(false);
    setOwner(null);
    setAddress(null);
    setChainId(null);
    setBalance(0);
  }, []);

  const requestFaucet = useCallback(async () => {
    try {
      const result = await lineraWalletService.requestFaucet();
      setBalance(result.newBalance);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    owner,
    address,
    chainId,
    balance,
    error,
    connect,
    disconnect,
    requestFaucet,
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

  const playGame = useCallback(async (gameType, betAmount, gameParams = {}) => {
    setIsPlaying(true);
    setError(null);
    setLastResult(null);

    try {
      console.log(`🎮 Playing ${gameType} with ${betAmount} LINERA...`);
      
      const result = await lineraWalletService.placeBet(gameType, betAmount, gameParams);
      
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
    GAME_TYPES,
  };
}

/**
 * Game history hook
 */
export function useLineraStats() {
  const [gameHistory, setGameHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const history = await lineraWalletService.getGameHistory();
      setGameHistory(history);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lineraWalletService.isConnected()) {
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

export { GAME_TYPES, LINERA_CONFIG };
