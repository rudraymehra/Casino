"use client";

import React, { useState } from 'react';
import { useLineraWallet } from '@/hooks/useLineraWallet';

export default function LineraConnectButton() {
  const { 
    isConnected, 
    isConnecting, 
    address, 
    balance, 
    connect, 
    disconnect, 
    requestFaucet,
    error 
  } = useLineraWallet();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [isConnectingLocal, setIsConnectingLocal] = useState(false);

  const handleOpenModal = () => {
    setConnectError(null);
    setShowConnectModal(true);
  };

  const handleCloseModal = () => {
    setShowConnectModal(false);
    setConnectError(null);
  };

  const handleConnectDesktop = async () => {
    setConnectError(null);
    setIsConnectingLocal(true);
    try {
      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error('Please install MetaMask extension');
      }
      
      // Request accounts - this should trigger MetaMask popup
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      
      if (accounts && accounts.length > 0) {
        // Now call the connect function to sync state
        await connect();
        setShowConnectModal(false);
      }
    } catch (err) {
      console.error("Failed to connect:", err);
      if (err.code === 4001) {
        setConnectError('Connection rejected by user');
      } else if (err.code === -32002) {
        setConnectError('Please check MetaMask for pending request');
      } else {
        setConnectError(err.message || 'Failed to connect');
      }
    } finally {
      setIsConnectingLocal(false);
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
    <>
      <button
        onClick={handleOpenModal}
        disabled={isConnecting || isConnectingLocal}
        className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-purple-800 disabled:to-indigo-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
      >
        {(isConnecting || isConnectingLocal) ? (
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

      {/* Wallet Connection Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
            <p className="text-gray-400 text-sm mb-6">Choose how you want to connect</p>

            {/* Error message */}
            {connectError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {connectError}
              </div>
            )}

            {/* Connection options */}
            <div className="space-y-3">
              {/* Desktop - MetaMask Extension */}
              <button
                onClick={handleConnectDesktop}
                disabled={isConnectingLocal}
                className="w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🦊</span>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">MetaMask</div>
                    <div className="text-gray-400 text-xs">Browser Extension</div>
                  </div>
                </div>
                {isConnectingLocal ? (
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              {/* Demo Mode */}
              <button
                onClick={async () => {
                  setIsConnectingLocal(true);
                  try {
                    await connect();
                    setShowConnectModal(false);
                  } catch (err) {
                    setConnectError(err.message);
                  } finally {
                    setIsConnectingLocal(false);
                  }
                }}
                disabled={isConnectingLocal}
                className="w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎮</span>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">Demo Mode</div>
                    <div className="text-gray-400 text-xs">Try with test tokens</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Help text */}
            <p className="mt-6 text-center text-gray-500 text-xs">
              Don't have MetaMask?{' '}
              <a 
                href="https://metamask.io/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                Download here
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
