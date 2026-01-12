"use client";
/**
 * LineraGameWrapper - Wrapper component for Linera blockchain integration
 * Provides wallet connection, game operations, and transaction handling
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLineraWallet, useLineraGame, GAME_TYPES } from '@/hooks/useLineraWallet';
import { LINERA_CONFIG } from '@/config/lineraConfig';
import { FaWallet, FaSpinner, FaCheck, FaExternalLinkAlt, FaCopy, FaTimes } from 'react-icons/fa';

/**
 * Wallet Connection Button Component
 */
export function LineraWalletButton({ className = '' }) {
  const { isConnected, isConnecting, owner, connect, disconnect, error } = useLineraWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  const truncatedOwner = useMemo(() => {
    if (!owner) return '';
    return `${owner.substring(0, 10)}...${owner.substring(owner.length - 6)}`;
  }, [owner]);

  const copyAddress = useCallback(() => {
    if (owner) {
      navigator.clipboard.writeText(owner);
    }
  }, [owner]);

  if (isConnected) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 
                     text-white rounded-xl font-medium shadow-lg hover:shadow-emerald-500/30 
                     transition-all duration-300"
        >
          <FaWallet className="w-4 h-4" />
          <span>{truncatedOwner}</span>
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full right-0 mt-2 p-4 bg-gray-800 rounded-xl shadow-xl 
                         border border-gray-700 min-w-[200px] z-50"
            >
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-700">
                <span className="text-gray-400 text-sm">Connected to Linera</span>
                <FaCheck className="w-3 h-3 text-emerald-500" />
              </div>
              
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 
                           hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                <FaCopy className="w-4 h-4" />
                Copy Address
              </button>
              
              <a
                href={LINERA_CONFIG.getChainExplorerUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 
                           hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                <FaExternalLinkAlt className="w-4 h-4" />
                View on Explorer
              </a>
              
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-red-400 
                           hover:bg-gray-700 rounded-lg transition-colors text-sm mt-2"
              >
                <FaTimes className="w-4 h-4" />
                Disconnect
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 
                  text-white rounded-xl font-medium shadow-lg hover:shadow-purple-500/30 
                  transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isConnecting ? (
        <>
          <FaSpinner className="w-4 h-4 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <FaWallet className="w-4 h-4" />
          <span>Connect Linera</span>
        </>
      )}
    </button>
  );
}

/**
 * Game Transaction Status Component
 */
function TransactionStatus({ status, txHash, error }) {
  if (!status && !error) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl ${error ? 'bg-red-900/50' : 'bg-blue-900/50'} 
                  border ${error ? 'border-red-500/50' : 'border-blue-500/50'}`}
    >
      {error ? (
        <div className="flex items-center gap-2 text-red-400">
          <FaTimes className="w-4 h-4" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400">
            <FaSpinner className="w-4 h-4 animate-spin" />
            <span>{status}</span>
          </div>
          {txHash && (
            <a
              href={LINERA_CONFIG.getExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              View TX <FaExternalLinkAlt className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Linera Game Wrapper HOC
 * Wraps game components with Linera integration
 */
export function LineraGameWrapper({
  children,
  gameType, // 'Roulette' | 'Plinko' | 'Mines' | 'Wheel'
  onGameResult,
}) {
  const { isConnected } = useLineraWallet();
  const {
    isPlacingBet,
    isRevealing,
    currentGame,
    gameResult,
    error: gameError,
    playGame,
    resetGame,
  } = useLineraGame();

  const [txStatus, setTxStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  /**
   * Handle game play through Linera contract
   */
  const handlePlayGame = useCallback(async (betAmount, gameParams = '') => {
    if (!isConnected) {
      throw new Error('Please connect your Linera wallet first');
    }

    try {
      setTxStatus('Placing bet on Linera blockchain...');
      
      // Convert bet amount to attos
      const betAttos = LINERA_CONFIG.tokensToAttos(betAmount);
      
      // Play the game
      const result = await playGame(gameType, betAttos, gameParams);
      
      setTxStatus('Game completed!');
      setTxHash(result?.txHash || '');
      
      // Parse and return the result
      if (result && onGameResult) {
        onGameResult(result);
      }
      
      return result;
    } catch (err) {
      console.error('[LineraGameWrapper] Game error:', err);
      throw err;
    } finally {
      setTimeout(() => {
        setTxStatus('');
        setTxHash('');
      }, 5000);
    }
  }, [isConnected, gameType, playGame, onGameResult]);

  // Inject Linera functions into children
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        lineraPlayGame: handlePlayGame,
        lineraIsPlaying: isPlacingBet || isRevealing,
        lineraCurrentGame: currentGame,
        lineraGameResult: gameResult,
        lineraResetGame: resetGame,
        lineraIsConnected: isConnected,
      });
    }
    return child;
  });

  return (
    <div className="relative">
      {/* Transaction Status */}
      <AnimatePresence>
        {(txStatus || gameError) && (
          <div className="absolute top-0 left-0 right-0 z-50 p-4">
            <TransactionStatus status={txStatus} txHash={txHash} error={gameError} />
          </div>
        )}
      </AnimatePresence>

      {/* Render children with injected props */}
      {childrenWithProps}
    </div>
  );
}

/**
 * Linera Network Badge Component
 */
export function LineraNetworkBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-900/50 to-teal-900/50 
                    border border-emerald-500/30 rounded-full">
      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      <span className="text-emerald-400 text-xs font-medium">Linera Conway Testnet</span>
    </div>
  );
}

/**
 * Game Stats Component (on-chain)
 */
export function LineraGameStats() {
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    totalWagered: '0',
    totalPayout: '0',
  });

  // Stats would be fetched from the contract in a real implementation
  // For now, show placeholder

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
      <div className="text-center">
        <p className="text-gray-400 text-xs">Games Played</p>
        <p className="text-white font-bold">{stats.gamesPlayed}</p>
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs">Total Wagered</p>
        <p className="text-white font-bold">{stats.totalWagered} LINERA</p>
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs">Total Payout</p>
        <p className="text-white font-bold">{stats.totalPayout} LINERA</p>
      </div>
    </div>
  );
}

export default LineraGameWrapper;

