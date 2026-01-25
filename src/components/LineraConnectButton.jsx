"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLineraWallet } from '@/hooks/useLineraWallet';
import { useSelector, useDispatch } from 'react-redux';
import { setBalance } from '@/store/balanceSlice';
import WalletPasswordModal from './WalletPasswordModal';
import { hasStoredWallet } from '@/utils/lineraWalletCrypto';
import { lineraWalletService } from '@/services/LineraWalletService';

export default function LineraConnectButton() {
  const {
    isConnected: hookIsConnected,
    isConnecting,
    needsPassword: hookNeedsPassword,
    address,
    balance: lineraBalance,
    connect,
    disconnect,
    requestFaucet,
    lockWallet,
    isLocked,
    error
  } = useLineraWallet();

  // Use Redux balance to stay in sync with game balance
  const { userBalance } = useSelector((state) => state.balance);
  const dispatch = useDispatch();
  const [displayBalance, setDisplayBalance] = useState(0);

  // Track if we're on the client (for SSR compatibility)
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Sync wallet balance to Redux when connected
  // Priority: localStorage userBalance (most recent from game wins/losses) > lineraBalance
  useEffect(() => {
    if (hookIsConnected) {
      // Check localStorage for the most recent balance (from game play)
      const storedBalance = typeof window !== 'undefined' ? localStorage.getItem('userBalance') : null;
      const storedBalanceNum = storedBalance ? parseFloat(storedBalance) : 0;

      // Use stored balance if it's valid and different from lineraBalance
      // This preserves balance after game wins/losses
      if (storedBalanceNum > 0) {
        dispatch(setBalance(storedBalance));
        setDisplayBalance(storedBalanceNum);
        console.log('Restored balance from localStorage:', storedBalanceNum);
      } else if (lineraBalance > 0) {
        dispatch(setBalance(lineraBalance.toString()));
        if (typeof window !== 'undefined') {
          localStorage.setItem('userBalance', lineraBalance.toString());
        }
        console.log('Using lineraBalance:', lineraBalance);
      }
    }
  }, [hookIsConnected, lineraBalance, dispatch]);

  // Check localStorage directly - only on client side
  const checkPersistedConnection = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const demoState = localStorage.getItem('demo-wallet-state');
    const demoOwner = localStorage.getItem('demo-wallet-owner');
    const savedBalance = localStorage.getItem('userBalance');
    return demoState === 'connected' && demoOwner && savedBalance && parseFloat(savedBalance) > 0;
  }, []);

  // Only consider connected if the actual wallet hook says connected
  // This ensures faucet/withdraw operations work properly
  const isConnected = hookIsConnected;

  // Sync display balance with game balance (PC balance)
  useEffect(() => {
    const gameBalance = parseFloat(userBalance || '0');
    if (gameBalance > 0) {
      setDisplayBalance(gameBalance);
    } else {
      setDisplayBalance(lineraBalance);
    }
  }, [userBalance, lineraBalance]);

  // Sync Redux balance changes back to wallet service
  // This ensures the wallet service has the latest balance after game wins/losses
  const prevBalanceRef = useRef(userBalance);
  useEffect(() => {
    if (hookIsConnected && userBalance !== prevBalanceRef.current) {
      const newBalance = parseFloat(userBalance || '0');
      // Only update if balance actually changed and is valid
      if (!isNaN(newBalance) && newBalance >= 0) {
        lineraWalletService.setBalance(newBalance);
        console.log('Synced Redux balance to wallet service:', newBalance);
      }
      prevBalanceRef.current = userBalance;
    }
  }, [hookIsConnected, userBalance]);

  const balance = displayBalance || 0;

  const [showDropdown, setShowDropdown] = useState(false);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordMode, setPasswordMode] = useState('unlock'); // 'create' or 'unlock'
  const [passwordError, setPasswordError] = useState(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const hasShownModalRef = useRef(false);

  // Check if we need to show password modal on mount or when wallet needs password
  useEffect(() => {
    // Only auto-show modal once per session, and only if not already loading
    if (hookNeedsPassword && !showPasswordModal && !isPasswordLoading && !hasShownModalRef.current) {
      hasShownModalRef.current = true;
      setPasswordMode(hasStoredWallet() ? 'unlock' : 'create');
      setShowPasswordModal(true);
    }
    // Reset the flag when wallet connects successfully
    if (hookIsConnected) {
      hasShownModalRef.current = false;
    }
  }, [hookNeedsPassword, showPasswordModal, isPasswordLoading, hookIsConnected]);

  const handleConnect = useCallback(async () => {
    try {
      setPasswordError(null);

      // Check if there's a stored wallet
      const hasWallet = hasStoredWallet();

      if (hasWallet) {
        // Existing wallet - need to unlock
        setPasswordMode('unlock');
        setShowPasswordModal(true);
      } else {
        // No wallet - try to connect (may prompt for password if needed)
        const result = await connect();
        if (result?.needsPassword) {
          setPasswordMode(result.hasStoredWallet ? 'unlock' : 'create');
          setShowPasswordModal(true);
        }
      }
    } catch (err) {
      console.error("Failed to connect Linera wallet:", err);
      // If connection needs password, show modal
      if (err.message?.includes('password') || err.message?.includes('needsPassword')) {
        setPasswordMode(hasStoredWallet() ? 'unlock' : 'create');
        setShowPasswordModal(true);
      }
    }
  }, [connect]);

  const handlePasswordSubmit = useCallback(async (password) => {
    setIsPasswordLoading(true);
    setPasswordError(null);

    try {
      const isCreate = passwordMode === 'create';
      await connect(password, isCreate);
      setShowPasswordModal(false);
    } catch (err) {
      console.error("Password error:", err);
      setPasswordError(err.message || 'Failed to unlock wallet');
      throw err;
    } finally {
      setIsPasswordLoading(false);
    }
  }, [connect, passwordMode]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      // Clear display balance
      setDisplayBalance(0);
      setShowDropdown(false);
    } catch (err) {
      console.error("Failed to disconnect Linera wallet:", err);
    }
  }, [disconnect]);

  const handleLock = useCallback(() => {
    if (lockWallet) {
      lockWallet();
      setShowDropdown(false);
    }
  }, [lockWallet]);

  const handleFaucet = useCallback(async () => {
    setIsFaucetLoading(true);
    try {
      await requestFaucet();
    } catch (err) {
      console.error("Failed to request from faucet:", err);
    } finally {
      setIsFaucetLoading(false);
    }
  }, [requestFaucet]);

  const formatAddress = (addr) => {
    if (!addr) return '';
    // Handle User: prefix
    const cleanAddr = addr.replace(/^User:/, '');
    if (cleanAddr.length <= 12) return cleanAddr;
    return `${cleanAddr.substring(0, 6)}...${cleanAddr.substring(cleanAddr.length - 4)}`;
  };

  if (isConnected) {
    return (
      <>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-900/20"
          >
            <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></span>
            <span>{balance.toFixed(2)} LINERA</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-emerald-900/30 to-teal-900/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">Linera Wallet</div>
                    <div className="text-gray-400 text-xs font-mono">{formatAddress(address)}</div>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="p-4 border-b border-gray-700">
                <div className="text-gray-400 text-xs mb-1">Balance</div>
                <div className="text-2xl font-bold text-emerald-400">{balance.toFixed(2)} LINERA</div>
              </div>

              {/* Network */}
              <div className="p-4 border-b border-gray-700">
                <div className="text-gray-400 text-xs mb-2">Network</div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-white text-sm">Linera Conway Testnet</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-3 space-y-2">
                {/* Faucet button */}
                <button
                  onClick={handleFaucet}
                  disabled={isFaucetLoading}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2"
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
                      <span>Get 100 LINERA</span>
                    </>
                  )}
                </button>

                {/* Lock button (only for native wallets) */}
                {lockWallet && (
                  <button
                    onClick={handleLock}
                    className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Lock Wallet</span>
                  </button>
                )}

                {/* Disconnect button */}
                <button
                  onClick={handleDisconnect}
                  className="w-full px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors"
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

        {/* Password Modal */}
        <WalletPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSubmit={handlePasswordSubmit}
          mode={passwordMode}
          isLoading={isPasswordLoading}
          error={passwordError}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-900/20"
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

      {/* Password Modal */}
      <WalletPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordSubmit}
        mode={passwordMode}
        isLoading={isPasswordLoading}
        error={passwordError}
      />
    </>
  );
}
