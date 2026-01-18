"use client";

import React, { useState, useEffect } from 'react';
import { useLineraWallet } from '@/hooks/useLineraWallet';
import { useSelector } from 'react-redux';

export default function LineraConnectButton() {
  const { 
    isConnected, 
    isConnecting, 
    address, 
    balance: lineraBalance, 
    connect, 
    disconnect, 
    requestFaucet,
    error 
  } = useLineraWallet();
  
  // Use Redux balance to stay in sync with game balance
  const { userBalance } = useSelector((state) => state.balance);
  const [displayBalance, setDisplayBalance] = useState(0);
  
  // Sync display balance with game balance (PC balance)
  useEffect(() => {
    const gameBalance = parseFloat(userBalance || '0');
    if (gameBalance > 0) {
      setDisplayBalance(gameBalance);
    } else {
      setDisplayBalance(lineraBalance);
    }
  }, [userBalance, lineraBalance]);
  
  const balance = displayBalance;
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error("Failed to connect Linera wallet:", err);
    }
  };

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

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-purple-800 disabled:to-indigo-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
    >
      {isConnecting ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Connect Wallet</span>
        </>
      )}
    </button>
  );
}
