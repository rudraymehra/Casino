"use client";
import React, { useState, useEffect } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';

export default function ArbitrumConnectWalletButton() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  useEffect(() => {
    // Check initial state
    setIsConnected(lineraWalletService.isConnected());
    setAddress(lineraWalletService.userAddress);

    const unsubscribe = lineraWalletService.addListener((event, data) => {
      if (event === 'connected') {
        setIsConnected(true);
        setAddress(data?.address);
      } else if (event === 'disconnected') {
        setIsConnected(false);
        setAddress(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleConnect = async () => {
    try {
      console.log('🔗 Attempting to connect Linera wallet...');
      await lineraWalletService.connect();
      console.log('✅ Wallet connected successfully');
    } catch (error) {
      console.error('❌ Connection error:', error);
      alert(`Connection failed: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await lineraWalletService.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  return (
    <div className="relative">
      {isConnected ? (
        <div className="flex items-center gap-3">
          <span className="text-white text-sm">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-lg transition-all transform hover:scale-105"
        >
          Connect Linera
        </button>
      )}
    </div>
  );
}
