"use client";

import React, { useState, useEffect } from 'react';
import { useLineraWallet } from '@/hooks/useLineraWallet';
import { usePushWalletContext, PushUI, PushUniversalAccountButton } from '@pushchain/ui-kit';

export default function LineraConnectButton() {
  const { 
    isConnected: lineraConnected, 
    isConnecting, 
    address, 
    balance, 
    connect, 
    disconnect, 
    requestFaucet,
    error 
  } = useLineraWallet();
  
  // Also use Push wallet for connection modal
  const { connectionStatus } = usePushWalletContext();
  const isPushConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const isConnected = lineraConnected || isPushConnected;
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);

  // Sync Linera wallet when Push wallet connects
  useEffect(() => {
    if (isPushConnected && !lineraConnected) {
      // Trigger Linera connection when Push wallet connects
      connect().catch(err => console.log('Linera sync:', err));
    }
  }, [isPushConnected, lineraConnected, connect]);

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
    } catch (err) {
      console.error("Failed to disconnect Linera wallet:", err);
    }
  };

  const handleFaucet = async () => {
    setIsFaucetLoading(true);
    try {
      await requestFaucet();
    } catch (err) {
      console.error("Failed to request from faucet:", err);
    } finally {
      setIsFaucetLoading(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
          <span>{balance.toFixed(2)} LINERA</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
            <div className="p-4 border-b border-gray-700">
              <div className="text-gray-400 text-xs mb-1">Connected Wallet</div>
              <div className="text-white font-mono text-sm">{formatAddress(address)}</div>
            </div>
            
            <div className="p-4 border-b border-gray-700">
              <div className="text-gray-400 text-xs mb-1">Balance</div>
              <div className="text-2xl font-bold text-green-400">{balance.toFixed(2)} LINERA</div>
            </div>

            <div className="p-4 border-b border-gray-700">
              <div className="text-gray-400 text-xs mb-2">Network</div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-white text-sm">Linera Conway Testnet</span>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={handleFaucet}
                disabled={isFaucetLoading}
                className="w-full mb-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {isFaucetLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Requesting...</span>
                  </>
                ) : (
                  <>
                    <span>💰</span>
                    <span>Get 100 LINERA (Faucet)</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close */}
        {showDropdown && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // When not connected, use Push Universal Account Button which has proper Desktop/Mobile modal
  return (
    <div className="linera-connect-button">
      <PushUniversalAccountButton />
    </div>
  );
}
