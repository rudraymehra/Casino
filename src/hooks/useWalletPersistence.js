import { useEffect, useState } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';
import { hasStoredWallet } from '@/utils/lineraWalletCrypto';

/**
 * Hook to handle wallet connection persistence
 * Automatically manages Linera wallet state on page refresh/navigation
 */
export const useWalletPersistence = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  useEffect(() => {
    // Check initial state
    const checkState = () => {
      const connected = lineraWalletService.isConnected();
      setIsConnected(connected);
      setAddress(lineraWalletService.userAddress);
    };

    // Check after a small delay to ensure service is ready
    const timer = setTimeout(checkState, 500);

    // Listen for wallet events
    const unsubscribe = lineraWalletService.addListener((event, data) => {
      console.log('Wallet persistence event:', event);

      if (event === 'connected') {
        setIsConnected(true);
        setAddress(data?.address);
      } else if (event === 'disconnected') {
        setIsConnected(false);
        setAddress(null);
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Save connection state when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      console.log('Linera Wallet connected, state saved');
    }
  }, [isConnected, address]);

  return {
    isConnected,
    address,
    hasStoredWallet: hasStoredWallet(),
    disconnect: () => {
      console.log('Manual disconnect triggered');
      lineraWalletService.disconnect();
    }
  };
};
