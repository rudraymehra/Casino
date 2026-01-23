"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { lineraWalletService } from '@/services/LineraWalletService';
import { hasStoredWallet } from '@/utils/lineraWalletCrypto';

/**
 * Page Navigation Persistence Hook
 * Handles wallet state on page navigation for Linera Wallet
 */
export const usePageNavigationPersistence = () => {
  const pathname = usePathname();
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    console.log('Page navigation detected:', pathname);

    // Check initial state
    const connected = lineraWalletService.isConnected();
    const addr = lineraWalletService.userAddress;
    setIsConnected(connected);
    setAddress(addr);

    console.log('Current wallet state:', { isConnected: connected, address: addr });

    // Check if we need to reconnect after page navigation
    const checkNavigationReconnection = () => {
      const needsUnlock = hasStoredWallet() && !lineraWalletService.isConnected();

      console.log('Navigation wallet check:', {
        pathname,
        hasStoredWallet: hasStoredWallet(),
        needsUnlock,
        isConnected: connected,
        address: addr
      });

      // If wallet was connected but is not currently connected
      if (needsUnlock) {
        console.log('Page navigation: Stored wallet needs unlock');
        // The wallet will prompt for password when user clicks connect
      }
    };

    // Add a small delay to ensure the page has fully loaded
    const timer = setTimeout(checkNavigationReconnection, 500);

    // Listen for wallet events
    const unsubscribe = lineraWalletService.addListener((event, data) => {
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
  }, [pathname]);

  return {
    isConnected,
    address
  };
};
