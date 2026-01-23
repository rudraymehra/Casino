"use client";

import React, { useState, useEffect } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';

const NetworkSwitcher = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsConnected(lineraWalletService.isConnected());

    // Listen for wallet events
    const unsubscribe = lineraWalletService.addListener((event) => {
      if (event === 'connected') {
        setIsConnected(true);
        setIsWrongNetwork(false); // Linera wallet is always on correct network
      } else if (event === 'disconnected') {
        setIsConnected(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Linera wallet is always on the correct network
  if (!isConnected || !isWrongNetwork) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-red-600/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg border border-red-500/50 shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <p className="font-medium">Wrong Network</p>
            <p className="text-sm text-red-200">Please connect to Linera Conway Testnet</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkSwitcher;
