/**
 * Linera Wallet Connect Component - Production Implementation
 *
 * Connects to Croissant wallet extension (window.linera)
 * Shows install prompt if wallet not detected
 *
 * Reference: https://github.com/Nirajsah/croissant
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { lineraChainService, LINERA_CONFIG } from '@/services/LineraChainService';

// Wallet connection states
const ConnectionState = {
  CHECKING: 'checking',
  NOT_INSTALLED: 'not_installed',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

export default function LineraWalletConnect({
  onConnect,
  onDisconnect,
  showBalance = true,
  className = '',
}) {
  const [state, setState] = useState(ConnectionState.CHECKING);
  const [walletInfo, setWalletInfo] = useState(null);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  // Check for wallet installation and existing connection on mount
  useEffect(() => {
    const checkWallet = async () => {
      const installed = await lineraChainService.initialize();

      if (!installed) {
        setState(ConnectionState.NOT_INSTALLED);
        return;
      }

      if (lineraChainService.checkConnection()) {
        const info = lineraChainService.getConnectionInfo();
        setState(ConnectionState.CONNECTED);
        setWalletInfo(info);
        setBalance(info.balance);
        onConnect?.(info);
      } else {
        setState(ConnectionState.DISCONNECTED);
      }
    };

    checkWallet();

    // Listen for wallet events
    const unsubscribe = lineraChainService.addListener((event, data) => {
      switch (event) {
        case 'connected':
          setState(ConnectionState.CONNECTED);
          setWalletInfo(data);
          setBalance(data.balance);
          onConnect?.(data);
          break;
        case 'disconnected':
          setState(ConnectionState.DISCONNECTED);
          setWalletInfo(null);
          setBalance(0);
          onDisconnect?.();
          break;
        case 'balanceChanged':
          setBalance(data.balance);
          break;
        case 'error':
          setState(ConnectionState.ERROR);
          setError(data.message);
          break;
      }
    });

    return () => unsubscribe();
  }, [onConnect, onDisconnect]);

  // Connect wallet
  const handleConnect = useCallback(async () => {
    try {
      setState(ConnectionState.CONNECTING);
      setError(null);

      const result = await lineraChainService.connectWallet();

      setState(ConnectionState.CONNECTED);
      setWalletInfo(result);
      setBalance(result.balance);
      onConnect?.(result);
    } catch (err) {
      console.error('Connection failed:', err);
      setState(ConnectionState.ERROR);
      setError(err.message);
    }
  }, [onConnect]);

  // Disconnect wallet
  const handleDisconnect = useCallback(() => {
    lineraChainService.disconnect();
    setState(ConnectionState.DISCONNECTED);
    setWalletInfo(null);
    setBalance(0);
    setShowDropdown(false);
    onDisconnect?.();
  }, [onDisconnect]);

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // Wallet not installed - show install prompt
  if (state === ConnectionState.NOT_INSTALLED) {
    return (
      <div className={className}>
        <a
          href={lineraChainService.getWalletInstallUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200
                     bg-gradient-to-r from-amber-500 to-orange-500 text-white
                     hover:from-amber-600 hover:to-orange-600 shadow-lg hover:shadow-amber-500/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Install Linera Wallet</span>
        </a>
        <p className="mt-2 text-xs text-gray-400">
          Croissant wallet extension required
        </p>
      </div>
    );
  }

  // Connected state
  if (state === ConnectionState.CONNECTED && walletInfo) {
    return (
      <div className={`relative ${className}`}>
        {/* Connected Wallet Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500
                     rounded-xl text-white font-medium hover:from-emerald-600 hover:to-teal-600
                     transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
        >
          {/* Linera Logo */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {showBalance && (
            <span className="font-mono">{balance.toFixed(2)} LINERA</span>
          )}

          <span className="text-sm opacity-80">{formatAddress(walletInfo.owner)}</span>

          {/* Dropdown Arrow */}
          <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-gray-900 rounded-xl shadow-2xl
                          border border-gray-700 overflow-hidden z-50 animate-fadeIn">
            {/* Wallet Info */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Connected to Linera</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                  On-Chain
                </span>
              </div>

              <div className="text-white font-mono text-sm break-all">
                {walletInfo.owner}
              </div>

              {walletInfo.chainId && (
                <div className="mt-2 text-xs text-gray-500">
                  Chain: {formatAddress(walletInfo.chainId)}
                </div>
              )}
            </div>

            {/* Balance */}
            <div className="p-4 border-b border-gray-700 bg-gray-800/50">
              <div className="text-gray-400 text-sm mb-1">Balance</div>
              <div className="text-2xl font-bold text-white">
                {balance.toFixed(4)} <span className="text-emerald-400 text-lg">LINERA</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2">
              {walletInfo.explorerUrl && (
                <a
                  href={walletInfo.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800
                             rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                  <span className="text-xl">&#128269;</span>
                  <div>
                    <div className="font-medium">View on Explorer</div>
                    <div className="text-xs text-gray-500">Conway Testnet Explorer</div>
                  </div>
                </a>
              )}

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-900/30
                           rounded-lg transition-colors text-red-400"
              >
                <span className="text-xl">&#128682;</span>
                <div>
                  <div className="font-medium">Disconnect</div>
                  <div className="text-xs text-red-400/60">End session</div>
                </div>
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

  // Checking / Disconnected / Connecting / Error states
  return (
    <div className={className}>
      <button
        onClick={handleConnect}
        disabled={state === ConnectionState.CONNECTING || state === ConnectionState.CHECKING}
        className={`
          flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200
          ${state === ConnectionState.CONNECTING || state === ConnectionState.CHECKING
            ? 'bg-gray-700 text-gray-400 cursor-wait'
            : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg hover:shadow-emerald-500/25'
          }
        `}
      >
        {state === ConnectionState.CONNECTING || state === ConnectionState.CHECKING ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>{state === ConnectionState.CHECKING ? 'Checking...' : 'Connecting...'}</span>
          </>
        ) : (
          <>
            {/* Linera Logo */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Connect Wallet</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {state === ConnectionState.ERROR && error && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

// Export for use in other components
export { ConnectionState, LINERA_CONFIG };
