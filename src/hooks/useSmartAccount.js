"use client";

import { useState, useEffect } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';

/**
 * Linera Wallet Account Hook
 * Provides wallet account info and capabilities
 */
export const useSmartAccount = () => {
  const [accountInfo, setAccountInfo] = useState(null);
  const [isLineraAccount, setIsLineraAccount] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAccountInfo = () => {
      const isConnected = lineraWalletService.isConnected();
      const address = lineraWalletService.userAddress;

      if (!isConnected || !address) {
        setAccountInfo(null);
        setIsLineraAccount(false);
        setCapabilities(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Linera wallet provides account functionality
        const info = {
          isLineraAccount: true,
          address: address,
          owner: lineraWalletService.userOwner,
          chainId: lineraWalletService.connectedChain,
          features: {
            nativeToken: true,
            multiChain: true,
            faucet: true
          }
        };
        setAccountInfo(info);
        setIsLineraAccount(true);

        // Linera capabilities
        const caps = {
          isSupported: true,
          capabilities: {
            nativeToken: true,
            multiChain: true,
            faucet: true
          },
          provider: 'Linera Wallet'
        };
        setCapabilities(caps);

        console.log('Linera Account Info:', info);
      } catch (err) {
        console.error('Error loading account info:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountInfo();

    // Listen for wallet events
    const unsubscribe = lineraWalletService.addListener((event) => {
      if (event === 'connected' || event === 'disconnected') {
        loadAccountInfo();
      }
    });

    return () => unsubscribe();
  }, []);

  const requestFaucet = async () => {
    if (!lineraWalletService.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      setIsLoading(true);
      return await lineraWalletService.requestFaucet();
    } catch (err) {
      console.error('Faucet error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // State
    smartAccountInfo: accountInfo,
    isSmartAccount: isLineraAccount,
    capabilities,
    isLoading,
    error,

    // Actions
    requestFaucet,

    // Computed values
    hasSmartAccountSupport: !!capabilities?.isSupported,
    supportedFeatures: accountInfo?.features || {},
  };
};
