"use client";
import { useState, useEffect, useCallback } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';

// Mock functions for demo purposes - using Linera wallet
const CASINO_MODULE_ADDRESS = process.env.NEXT_PUBLIC_CASINO_MODULE_ADDRESS || "0x0000000000000000000000000000000000000000";

const formatAmount = (amount) => {
  return (parseFloat(amount) / 100000000).toFixed(8);
};

const parseAmount = (amount) => {
  return (parseFloat(amount) * 100000000).toString();
};

export const useEthereumCasino = () => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for Linera wallet changes
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = lineraWalletService.isConnected();
      const address = lineraWalletService.userAddress;
      const bal = lineraWalletService.getBalance();
      setConnected(isConnected);
      setAccount(address);
      setBalance(bal.toString());
    };

    checkConnection();

    const unsubscribe = lineraWalletService.addListener((event, data) => {
      if (event === 'connected') {
        setConnected(true);
        setAccount(data?.address);
        setBalance((data?.balance || 0).toString());
      } else if (event === 'disconnected') {
        setConnected(false);
        setAccount(null);
        setBalance('0');
      } else if (event === 'balanceChanged') {
        setBalance((data?.balance || 0).toString());
      }
    });

    return () => unsubscribe();
  }, []);

  const updateBalance = useCallback(async () => {
    if (!account) return;

    try {
      setLoading(true);
      const bal = lineraWalletService.getBalance();
      setBalance(bal.toString());
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance('0');
    } finally {
      setLoading(false);
    }
  }, [account]);

  // Game functions using Linera
  const placeRouletteBet = useCallback(async (betType, betValue, amount, numbers = []) => {
    if (!connected || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const result = await lineraWalletService.placeBet('Roulette', parseFloat(amount), {
        betType,
        betValue,
        numbers
      });

      await updateBalance();
      return result;
    } catch (error) {
      console.error('Roulette bet failed:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [connected, account, updateBalance]);

  const getRouletteGameState = useCallback(async () => {
    return {
      isActive: false,
      currentRound: 1,
      lastResult: null
    };
  }, []);

  const startMinesGame = useCallback(async (betAmount, minesCount, tilesToReveal) => {
    if (!connected || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const result = await lineraWalletService.placeBet('Mines', parseFloat(betAmount), {
        minesCount,
        tilesToReveal
      });

      await updateBalance();
      return result;
    } catch (error) {
      console.error('Mines game start failed:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [connected, account, updateBalance]);

  const revealMinesTile = useCallback(async (gameId, tileIndex) => {
    if (!connected || !account) {
      throw new Error('Wallet not connected');
    }

    // Mock implementation
    return `mock_reveal_${Date.now()}`;
  }, [connected, account]);

  const cashoutMinesGame = useCallback(async (gameId) => {
    if (!connected || !account) {
      throw new Error('Wallet not connected');
    }

    await updateBalance();
    return `mock_cashout_${Date.now()}`;
  }, [connected, account, updateBalance]);

  const spinWheel = useCallback(async (betAmount, segments) => {
    if (!connected || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const result = await lineraWalletService.placeBet('Wheel', parseFloat(betAmount), {
        segments
      });

      await updateBalance();
      return result;
    } catch (error) {
      console.error('Wheel spin failed:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [connected, account, updateBalance]);

  const getCasinoBalance = useCallback(async () => {
    return "1000000.00";
  }, []);

  const getGameHistory = useCallback(async (gameType, limit = 10) => {
    try {
      return await lineraWalletService.getGameHistory();
    } catch (error) {
      console.error('Error getting game history:', error);
      return [];
    }
  }, []);

  return {
    balance,
    loading,
    error,
    connected,
    account,
    updateBalance,
    placeRouletteBet,
    getRouletteGameState,
    startMinesGame,
    revealMinesTile,
    cashoutMinesGame,
    spinWheel,
    getCasinoBalance,
    getGameHistory,
    formatEthAmount: formatAmount,
    parseEthAmount: parseAmount,
  };
};
