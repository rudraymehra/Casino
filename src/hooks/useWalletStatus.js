'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';

const WalletStatusContext = createContext(null);

export function WalletStatusProvider({ children }) {
  // Enable dev wallet for testing
  const isDev = process.env.NODE_ENV === 'development';

  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();

  const [devWallet, setDevWallet] = useState({
    isConnected: false,
    address: null,
    chain: null,
  });

  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isDev) return;

    // Auto-connect dev wallet in development mode
    const savedState = localStorage.getItem('dev-wallet-state');
    if (savedState === 'connected' || savedState === null) {
      // Auto-connect by default in dev mode
      localStorage.setItem('dev-wallet-state', 'connected');
      setDevWallet({
        isConnected: true,
        address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe', // Valid test address
        chain: { id: 'linera_testnet', name: 'Linera Conway Testnet' },
      });
      
      // Set initial demo balance if not already set
      const savedBalance = localStorage.getItem('userBalance');
      if (!savedBalance || parseFloat(savedBalance) === 0) {
        localStorage.setItem('userBalance', '1000');
        console.log('🎮 DEV MODE: Set initial demo balance to 1000 PC');
      }
    }

    const handleToggle = () => {
      setDevWallet((prev) => {
        const newState = !prev.isConnected;
        localStorage.setItem(
          'dev-wallet-state',
          newState ? 'connected' : 'disconnected'
        );

        return newState
          ? {
            isConnected: true,
            address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe', // Valid test address
            chain: { id: 'linera_testnet', name: 'Linera Conway Testnet' },
          }
          : {
            isConnected: false,
            address: null,
            chain: null,
          };
      });
    };

    window.addEventListener('dev-wallet-toggle', handleToggle);
    return () => {
      window.removeEventListener('dev-wallet-toggle', handleToggle);
    };
  }, [isDev]);

  const connectWallet = useCallback(async () => {
    if (isDev) {
      localStorage.setItem('dev-wallet-state', 'connected');
      setDevWallet({
        isConnected: true,
        address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe', // Valid test address
        chain: { id: 'push_chain_testnet', name: 'Push Chain Testnet' },
      });
      return;
    }

    try {
      // Push Universal Wallet handles connection automatically
      console.log('🔗 Push Universal Wallet connection initiated');
    } catch (err) {
      setError('Failed to connect to Push Universal Wallet: ' + err.message);
    }
  }, [isDev]);

  const disconnectWallet = useCallback(async () => {
    if (isDev) {
      localStorage.setItem('dev-wallet-state', 'disconnected');
      setDevWallet({
        isConnected: false,
        address: null,
        chain: null,
      });
      return;
    }

    try {
      // Push Universal Wallet handles disconnection automatically
      console.log('🔌 Push Universal Wallet disconnection initiated');
    } catch (err) {
      setError('Failed to disconnect wallet: ' + err.message);
    }
  }, [isDev]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Use dev wallet in dev mode, otherwise use Push wallet
  const pushConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const isConnected = isDev ? devWallet.isConnected : pushConnected;
  
  // Extract address from Push Chain account (handles both string and object formats)
  const extractPushAddress = () => {
    const account = pushChainClient?.universal?.account;
    if (!account) return null;
    
    // If it's already a string address
    if (typeof account === 'string') {
      // Handle CAIP format like "eip155:1:0x..."
      if (account.includes(':')) {
        const parts = account.split(':');
        return parts[parts.length - 1];
      }
      return account;
    }
    
    // If it's an object with address property
    if (typeof account === 'object') {
      return account.address || account.addr || account.walletAddress || null;
    }
    
    return null;
  };
  
  const address = isDev ? devWallet.address : extractPushAddress();
  const chain = isDev ? devWallet.chain : (pushConnected ? { id: 'push_chain_testnet', name: 'Push Chain Testnet' } : null);

  const currentStatus = {
    isConnected,
    address,
    chain,
  };

  // Debug currentStatus calculation
  console.log('🔍 Push Universal Wallet status:', {
    connectionStatus,
    isConnected,
    address,
    chain,
    pushChainClient: !!pushChainClient
  });

  useEffect(() => {
    console.log('🔌 Push Universal Wallet connection changed:');
    console.log('=== CURRENT STATUS ===');
    console.log('Connected:', currentStatus.isConnected);
    console.log('Address:', currentStatus.address);
    console.log('Chain:', currentStatus.chain);
    console.log('=== PUSH CHAIN VALUES ===');
    console.log('Connection Status:', connectionStatus);
    console.log('Push Chain Client:', !!pushChainClient);
    console.log('Universal Account:', pushChainClient?.universal?.account);
    console.log('=== ENVIRONMENT ===');
    console.log('Is Dev:', isDev);
    console.log('Dev Wallet:', devWallet);
  }, [currentStatus, connectionStatus, pushChainClient, isDev, devWallet]);

  return (
    <WalletStatusContext.Provider
      value={{
        ...currentStatus,
        isDev,
        connectWallet,
        disconnectWallet,
        resetError,
        error,
      }}
    >
      {children}
    </WalletStatusContext.Provider>
  );
}

export default function useWalletStatus() {
  const context = useContext(WalletStatusContext);
  if (!context) {
    throw new Error('useWalletStatus must be used within a WalletStatusProvider');
  }
  return context;
}
