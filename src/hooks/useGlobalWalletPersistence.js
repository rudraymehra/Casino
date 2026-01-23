"use client";
import { useEffect, useRef, useState } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';
import { hasStoredWallet } from '@/utils/lineraWalletCrypto';

/**
 * Global Wallet Persistence Hook
 * Works across all pages and components with Linera Wallet
 */
export const useGlobalWalletPersistence = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectAttempted = useRef(false);

  useEffect(() => {
    // Check initial state
    const checkState = () => {
      const connected = lineraWalletService.isConnected();
      setIsConnected(connected);
      setAddress(lineraWalletService.userAddress);

      // Check if we have a stored wallet that needs unlocking
      if (!connected && hasStoredWallet()) {
        console.log('Linera Wallet: Stored wallet found, needs unlock');
        setIsReconnecting(true);
      }
    };

    checkState();

    // Listen for wallet events
    const unsubscribe = lineraWalletService.addListener((event, data) => {
      console.log('Linera Wallet persistence event:', event);

      switch (event) {
        case 'connected':
          setIsConnected(true);
          setAddress(data?.address);
          setIsReconnecting(false);
          reconnectAttempted.current = false;
          break;
        case 'disconnected':
          setIsConnected(false);
          setAddress(null);
          setIsReconnecting(false);
          break;
        case 'needsPassword':
          setIsReconnecting(true);
          break;
        case 'locked':
          setIsConnected(false);
          setIsReconnecting(true);
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    isConnected,
    address,
    isReconnecting,
    globalState: {
      hasStoredWallet: hasStoredWallet(),
      needsUnlock: lineraWalletService.needsUnlock?.() || false,
    }
  };
};
