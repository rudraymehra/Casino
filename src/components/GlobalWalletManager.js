"use client";
import React from 'react';
import { useVercelWalletPersistence } from '@/hooks/useVercelWalletPersistence';
import { usePushWalletContext, PushUI } from '@pushchain/ui-kit';

/**
 * Global Wallet Manager
 * This component should be included in every page to ensure wallet persistence
 * Uses Vercel-specific persistence for better compatibility
 */
export default function GlobalWalletManager() {
  // Use Vercel-specific wallet persistence
  const { isConnected, address, isReconnecting, globalState } = useVercelWalletPersistence();
  const { connectionStatus } = usePushWalletContext();
  const [connectionAttempts, setConnectionAttempts] = React.useState(0);
  
  // Debug logging with more details
  React.useEffect(() => {
    console.log('🔧 GlobalWalletManager state:', {
      isConnected,
      address,
      isReconnecting,
      globalState,
      connectionStatus,
      connectionAttempts,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, address, isReconnecting, globalState, connectionStatus, connectionAttempts]);

  // Monitor connection status changes
  React.useEffect(() => {
    if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING) {
      console.log('⏳ GlobalWalletManager: Connection in progress...');
      setConnectionAttempts(prev => prev + 1);
    } else if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED) {
      console.log('✅ GlobalWalletManager: Connected successfully!');
      setConnectionAttempts(0);
    } else if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.DISCONNECTED) {
      console.log('❌ GlobalWalletManager: Disconnected');
    }
  }, [connectionStatus]);

  // Poll for connection status to catch delayed updates
  React.useEffect(() => {
    const pollInterval = setInterval(() => {
      if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING) {
        console.log('🔄 Polling: Still connecting...');
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [connectionStatus]);
  
  // This component doesn't render anything, it just manages wallet state
  return null;
}
