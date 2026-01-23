"use client";
import React, { useState, useEffect } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';
import GameHistoryList from '@/components/GameHistory/GameHistoryList';

/**
 * Game History Page
 * Shows user's complete gaming history with VRF verification
 */
const HistoryPage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Game History
              </h1>
              <p className="text-gray-600 mt-1">
                View your complete gaming history with blockchain verification
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-sm border p-8 max-w-md mx-auto">
              <span className="text-6xl mb-4 block">🔗</span>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-gray-600 mb-6">
                Connect your Linera wallet to view your gaming history and transaction details.
              </p>
              <button className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-colors font-medium">
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <GameHistoryList userAddress={address} />
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                🔒 Provably Fair Gaming
              </h3>
              <p className="text-gray-600 text-sm">
                Every game result is generated using Pyth Entropy, ensuring
                complete transparency and fairness. All results are verifiable
                on the Linera blockchain.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                🔍 Transaction Verification
              </h3>
              <p className="text-gray-600 text-sm">
                Click on any transaction hash to view the VRF request on the explorer.
                This allows you to independently verify that the randomness was
                generated fairly.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                📊 Complete History
              </h3>
              <p className="text-gray-600 text-sm">
                Your complete gaming history is stored securely and can be
                exported at any time. All data includes VRF details for
                full transparency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
