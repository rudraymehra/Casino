"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { lineraWalletService } from '@/services/LineraWalletService';
import { hasStoredWallet } from '@/utils/lineraWalletCrypto';

/**
 * Vercel-specific Wallet Persistence Hook
 * Handles wallet persistence in Vercel's edge runtime environment
 * Uses Linera Wallet for connection management
 */
export const useVercelWalletPersistence = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const reconnectAttempted = useRef(false);
  const reconnectTimeout = useRef(null);
  const lastPageCheck = useRef(0);

  // Global state for Vercel
  const globalState = useRef({
    isConnected: false,
    address: null,
    lastReconnectAttempt: 0
  });

  // Update global state when wallet connects
  useEffect(() => {
    const connected = lineraWalletService.isConnected();
    const addr = lineraWalletService.userAddress;

    if (connected && addr) {
      globalState.current = {
        isConnected: true,
        address: addr,
        lastReconnectAttempt: 0
      };
      setIsConnected(true);
      setAddress(addr);
      console.log('Vercel wallet connected, updating global state:', globalState.current);
    }
  }, []);

  // Listen for wallet events
  useEffect(() => {
    const unsubscribe = lineraWalletService.addListener((event, data) => {
      console.log('Vercel Linera Wallet event:', event);

      if (event === 'connected') {
        setIsConnected(true);
        setAddress(data?.address);
        setIsReconnecting(false);
        globalState.current.isConnected = true;
        globalState.current.address = data?.address;
      } else if (event === 'disconnected') {
        setIsConnected(false);
        setAddress(null);
        globalState.current.isConnected = false;
        globalState.current.address = null;
      } else if (event === 'needsPassword') {
        setIsReconnecting(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check for wallet reconnection
  useEffect(() => {
    // Clear any existing timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    const checkAndReconnect = () => {
      const currentTime = Date.now();

      console.log('Vercel Linera Wallet check:', {
        isConnected,
        address,
        hasStoredWallet: hasStoredWallet(),
        reconnectAttempted: reconnectAttempted.current,
        timeSinceLastCheck: currentTime - lastPageCheck.current,
      });

      // Update last check time
      lastPageCheck.current = currentTime;

      // Check if we have a stored wallet that needs unlocking
      if (!isConnected && hasStoredWallet() && !reconnectAttempted.current) {
        console.log('Vercel: Stored wallet found, needs unlock');
        setIsReconnecting(true);
        reconnectAttempted.current = true;
      }
    };

    // Very short delay for Vercel
    const delay = 500;
    reconnectTimeout.current = setTimeout(checkAndReconnect, delay);

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [isConnected, address]);

  return {
    isConnected,
    address,
    isReconnecting,
    globalState: globalState.current
  };
};
