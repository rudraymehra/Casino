'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

// Using Linera wallet instead of Push Chain
// Push Chain UI kit is not available, so we use Linera wallet service

const WalletStatusContext = createContext(null);

export function WalletStatusProvider({ children }) {
  const [walletState, setWalletState] = useState({
    isConnected: false,
    address: null,
    chain: null,
  });

  const [error, setError] = useState(null);

  // Check for existing connection on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check localStorage for persisted Linera wallet state
    const savedState = localStorage.getItem('linera_wallet_state');
    const sessionUnlocked = sessionStorage.getItem('linera_session_unlocked');

    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        // Check if wallet was unlocked AND session is still valid
        if (state.userOwner && (state.isUnlocked || sessionUnlocked === 'true')) {
          setWalletState({
            isConnected: true,
            address: state.userAddress || state.userOwner,
            chain: { id: 'linera_conway_testnet', name: 'Linera Conway Testnet' },
          });
        }
      } catch (e) {
        console.error('Failed to parse wallet state:', e);
      }
    }

    // Also check for demo wallet state (legacy)
    const demoState = localStorage.getItem('demo-wallet-state');
    const demoOwner = localStorage.getItem('demo-wallet-owner');
    if (demoState === 'connected' && demoOwner) {
      setWalletState({
        isConnected: true,
        address: demoOwner,
        chain: { id: 'linera_conway_testnet', name: 'Linera Conway Testnet' },
      });
    }
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      // This will be handled by LineraConnectButton
      console.log('🔗 Linera wallet connection initiated');
      // The actual connection is handled by the Linera wallet service
    } catch (err) {
      setError('Failed to connect wallet: ' + err.message);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      localStorage.removeItem('linera_wallet_state');
      localStorage.removeItem('demo-wallet-state');
      localStorage.removeItem('demo-wallet-owner');
      setWalletState({
        isConnected: false,
        address: null,
        chain: null,
      });
      console.log('🔌 Linera wallet disconnected');
    } catch (err) {
      setError('Failed to disconnect wallet: ' + err.message);
    }
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Listen for wallet state changes from LineraWalletService
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'linera_wallet_state') {
        const sessionUnlocked = sessionStorage.getItem('linera_session_unlocked');
        if (e.newValue) {
          try {
            const state = JSON.parse(e.newValue);
            setWalletState({
              isConnected: !!state.userOwner && (state.isUnlocked || sessionUnlocked === 'true'),
              address: state.userAddress || state.userOwner,
              chain: { id: 'linera_conway_testnet', name: 'Linera Conway Testnet' },
            });
          } catch (err) {
            console.error('Failed to parse wallet state:', err);
          }
        } else {
          setWalletState({
            isConnected: false,
            address: null,
            chain: null,
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <WalletStatusContext.Provider
      value={{
        ...walletState,
        isDev: false,
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
