'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';
import { lineraChainService } from '@/services/LineraChainService';

const WalletStatusContext = createContext(null);

export function WalletStatusProvider({ children }) {
  // Enable dev wallet for testing
  const isDev = process.env.NODE_ENV === 'development';

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

      // Set initial demo balance - ensure at least 1000 LINERA for demo
      const savedBalance = localStorage.getItem('userBalance');
      const currentBalance = savedBalance ? parseFloat(savedBalance) : 0;

      // If balance is 0 or not set, give demo tokens
      if (!savedBalance || currentBalance <= 0) {
        localStorage.setItem('userBalance', '1000');
        console.log('DEV MODE: Set demo balance to 1000 LINERA');
      } else {
        console.log('DEV MODE: Using existing balance:', currentBalance, 'LINERA');
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
            address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe',
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
        address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe',
        chain: { id: 'linera_testnet', name: 'Linera Conway Testnet' },
      });
      return;
    }

    try {
      // Linera Wallet handles connection
      console.log('Linera Wallet connection initiated');
    } catch (err) {
      setError('Failed to connect to Linera Wallet: ' + err.message);
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
      // Linera Wallet handles disconnection
      console.log('Linera Wallet disconnection initiated');
    } catch (err) {
      setError('Failed to disconnect wallet: ' + err.message);
    }
  }, [isDev]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Check Linera wallet status
  const [lineraConnected, setLineraConnected] = useState(false);
  const [lineraAddress, setLineraAddress] = useState(null);
  const [lineraBalance, setLineraBalance] = useState(0);

  useEffect(() => {
    // Check if Linera wallet is connected (check BOTH services)
    const checkLineraWallet = () => {
      // Check lineraWalletService (native/CheCko wallet)
      const walletServiceConnected = lineraWalletService.isConnected();
      const walletServiceAddr = lineraWalletService.userAddress;
      const walletServiceBal = lineraWalletService.getBalance();

      // Check lineraChainService (Croissant/demo mode)
      const chainServiceConnected = lineraChainService.checkConnection();
      const chainServiceInfo = lineraChainService.getConnectionInfo();

      // Use whichever service is connected
      const connected = walletServiceConnected || chainServiceConnected;
      const addr = walletServiceAddr || chainServiceInfo?.owner;
      const bal = walletServiceConnected ? walletServiceBal : (chainServiceInfo?.balance || 0);

      setLineraConnected(connected);
      setLineraAddress(addr);
      setLineraBalance(bal);

      // Sync Linera balance to localStorage for games to use
      if (connected && bal > 0) {
        const currentBalance = localStorage.getItem('userBalance');
        if (!currentBalance || parseFloat(currentBalance) === 0) {
          localStorage.setItem('userBalance', bal.toString());
          console.log('Synced Linera balance to game balance:', bal);
        }
      }
    };

    // Check immediately
    checkLineraWallet();

    // Listen for Linera wallet changes (lineraWalletService)
    const unsubscribe1 = lineraWalletService.addListener((event, data) => {
      if (event === 'connected') {
        setLineraConnected(true);
        setLineraAddress(data?.address);
        const bal = data?.balance || lineraWalletService.getBalance();
        setLineraBalance(bal);

        // Sync balance to localStorage
        if (bal > 0) {
          localStorage.setItem('userBalance', bal.toString());
          console.log('Linera connected - synced balance:', bal);
          // Trigger a storage event for other components
          window.dispatchEvent(new Event('storage'));
        }
      } else if (event === 'disconnected') {
        // Only set disconnected if chainService is also disconnected
        if (!lineraChainService.checkConnection()) {
          setLineraConnected(false);
          setLineraAddress(null);
          setLineraBalance(0);
        }
      } else if (event === 'balanceChanged') {
        const newBal = data?.balance || 0;
        setLineraBalance(newBal);
        localStorage.setItem('userBalance', newBal.toString());
        window.dispatchEvent(new Event('storage'));
      }
    });

    // Listen for Linera chain service changes (Croissant/demo mode)
    const unsubscribe2 = lineraChainService.addListener((event, data) => {
      if (event === 'connected') {
        setLineraConnected(true);
        setLineraAddress(data?.owner);
        const bal = data?.balance || 0;
        setLineraBalance(bal);

        // Sync balance to localStorage
        if (bal > 0) {
          localStorage.setItem('userBalance', bal.toString());
          console.log('LineraChainService connected - synced balance:', bal);
          window.dispatchEvent(new Event('storage'));
        }
      } else if (event === 'disconnected') {
        // Only set disconnected if walletService is also disconnected
        if (!lineraWalletService.isConnected()) {
          setLineraConnected(false);
          setLineraAddress(null);
          setLineraBalance(0);
        }
      } else if (event === 'balanceChanged') {
        const newBal = data?.balance || 0;
        setLineraBalance(newBal);
        localStorage.setItem('userBalance', newBal.toString());
        window.dispatchEvent(new Event('storage'));
      }
    });

    // Poll for changes (backup)
    const interval = setInterval(checkLineraWallet, 1000);

    return () => {
      unsubscribe1();
      unsubscribe2();
      clearInterval(interval);
    };
  }, []);

  // Check for demo mode in production (from localStorage)
  const [demoModeConnected, setDemoModeConnected] = useState(false);
  const [demoModeAddress, setDemoModeAddress] = useState(null);

  useEffect(() => {
    // Check for demo wallet state in production
    if (!isDev) {
      const demoState = localStorage.getItem('demo-wallet-state');
      const demoOwner = localStorage.getItem('demo-wallet-owner');

      if (demoState === 'connected' && demoOwner) {
        setDemoModeConnected(true);
        setDemoModeAddress(demoOwner);
      }
    }
  }, [isDev, lineraConnected]);

  // Use dev wallet in dev mode, otherwise use Linera wallet or demo mode
  const isConnected = isDev ? devWallet.isConnected : (lineraConnected || demoModeConnected);
  const address = isDev ? devWallet.address : (lineraAddress || demoModeAddress);
  const chain = isDev ? devWallet.chain : ((lineraConnected || demoModeConnected) ? { id: 'linera_testnet', name: 'Linera Conway Testnet' } : null);

  const currentStatus = {
    isConnected,
    address,
    chain,
    lineraBalance,
  };

  // Debug currentStatus calculation
  console.log('Linera Wallet status:', {
    isConnected,
    address,
    chain,
  });

  useEffect(() => {
    console.log('Linera Wallet connection changed:');
    console.log('=== CURRENT STATUS ===');
    console.log('Connected:', currentStatus.isConnected);
    console.log('Address:', currentStatus.address);
    console.log('Chain:', currentStatus.chain);
    console.log('=== ENVIRONMENT ===');
    console.log('Is Dev:', isDev);
    console.log('Dev Wallet:', devWallet);
  }, [currentStatus, isDev, devWallet]);

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
