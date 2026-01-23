"use client";
import React from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';

/**
 * Global Wallet Manager
 * This component should be included in every page to ensure wallet persistence
 * Uses Linera wallet for connection management
 */
export default function GlobalWalletManager() {
  const [isConnected, setIsConnected] = React.useState(false);
  const [address, setAddress] = React.useState(null);
  const [isReconnecting, setIsReconnecting] = React.useState(false);

  React.useEffect(() => {
    // Check initial connection state
    const checkConnection = () => {
      const connected = lineraWalletService.isConnected();
      setIsConnected(connected);
      setAddress(lineraWalletService.userAddress);
    };

    checkConnection();

    // Listen for wallet changes
    const unsubscribe = lineraWalletService.addListener((event, data) => {
      console.log('GlobalWalletManager: Linera wallet event:', event);

      if (event === 'connected') {
        setIsConnected(true);
        setAddress(data?.address);
        setIsReconnecting(false);
      } else if (event === 'disconnected') {
        setIsConnected(false);
        setAddress(null);
      } else if (event === 'needsPassword') {
        setIsReconnecting(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Debug logging
  React.useEffect(() => {
    console.log('GlobalWalletManager state:', {
      isConnected,
      address,
      isReconnecting,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, address, isReconnecting]);

  // This component doesn't render anything, it just manages wallet state
  return null;
}
