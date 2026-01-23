"use client";

import React, { useState, useEffect } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';

const SmartAccountInfo = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [smartAccountInfo, setSmartAccountInfo] = useState(null);

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

  useEffect(() => {
    if (isConnected && address) {
      // Linera wallet info
      setSmartAccountInfo({
        address,
        type: 'Linera Wallet',
        hasCode: true,
        features: ['Native Linera Support', 'Faucet Integration', 'Encrypted Storage']
      });
    } else {
      setSmartAccountInfo(null);
    }
  }, [isConnected, address]);

  if (!isConnected || !smartAccountInfo) return null;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-2">Account Information</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Address:</span>
          <span className="text-white font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Type:</span>
          <span className="font-medium text-emerald-400">
            {smartAccountInfo.type}
          </span>
        </div>
        {smartAccountInfo.features && (
          <div className="mt-2 p-2 bg-emerald-900/30 rounded border border-emerald-700">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span className="text-emerald-300 text-xs">Linera Wallet Features</span>
            </div>
            <div className="space-y-1">
              {smartAccountInfo.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-emerald-300 rounded-full"></div>
                  <span className="text-emerald-200 text-xs">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartAccountInfo;
