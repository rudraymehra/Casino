"use client";
import React from 'react';
import { PushUniversalAccountButton, usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';

export default function EthereumConnectWalletButton() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const [connectionError, setConnectionError] = React.useState(null);

  React.useEffect(() => {
    console.log('🔗 Push Wallet connection status:', connectionStatus);
    console.log('📱 Push Chain Client:', pushChainClient?.universal?.account || 'Not connected');
    
    // Check if connected
    if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED) {
      console.log('✅ Wallet connected successfully!');
      setConnectionError(null);
    } else if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.DISCONNECTED) {
      console.log('❌ Wallet disconnected');
    }
  }, [connectionStatus, pushChainClient]);

  // Add connection timeout handling
  React.useEffect(() => {
    let timeout;
    if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING) {
      console.log('⏳ Connecting to wallet...');
      timeout = setTimeout(() => {
        if (connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTING) {
          console.warn('⚠️ Connection is taking longer than expected');
          setConnectionError('Connection timeout - please try again');
        }
      }, 30000); // 30 second timeout
    }
    return () => clearTimeout(timeout);
  }, [connectionStatus]);

  return (
    <div className="relative">
      <PushUniversalAccountButton />
      {connectionError && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-red-500/20 border border-red-500/50 rounded p-2 text-xs text-red-300">
          {connectionError}
        </div>
      )}
    </div>
  );
} 