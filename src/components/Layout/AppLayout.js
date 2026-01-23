import React, { useState, useEffect } from 'react';
import { lineraWalletService } from '@/services/LineraWalletService';
import WalletConnectionHandler from '../Wallet/WalletConnectionHandler';
import { useVRFPregeneration } from '../../hooks/useVRFPregeneration';
import VRFStatusModal from '../VRF/VRFStatusModal';

/**
 * Main App Layout
 * Wraps the entire app with wallet connection handling
 */
const AppLayout = ({ children }) => {
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

  const {
    vrfStatus,
    totalVRF,
    isGenerating,
    showModal,
    openModal,
    closeModal,
    generateVRFBatch,
    canPlayGame
  } = useVRFPregeneration();

  return (
    <WalletConnectionHandler>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎰</span>
                  <span className="text-xl font-bold text-gray-900">
                    Casino VRF
                  </span>
                </div>
                <div className="hidden md:flex items-center space-x-6">
                  <a href="/" className="text-gray-700 hover:text-gray-900 transition-colors">
                    🎰 Roulette
                  </a>
                  <a href="/mines" className="text-gray-700 hover:text-gray-900 transition-colors">
                    💣 Mines
                  </a>
                  <a href="/plinko" className="text-gray-700 hover:text-gray-900 transition-colors">
                    🏀 Plinko
                  </a>
                  <a href="/wheel" className="text-gray-700 hover:text-gray-900 transition-colors">
                    🎡 Wheel
                  </a>
                  <a href="/history" className="text-gray-700 hover:text-gray-900 transition-colors">
                    📊 History
                  </a>
                </div>
              </div>

              {/* VRF Status & Wallet */}
              <div className="flex items-center gap-3">
                {/* VRF Status Button */}
                {isConnected && (
                  <button
                    onClick={() => {
                      console.log('🎲 VRF button clicked, opening modal...');
                      openModal();
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      totalVRF > 0
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    }`}
                  >
                    <span className="text-base">🎲</span>
                    <span className="hidden sm:inline">
                      VRF PROOFS: {totalVRF}
                    </span>
                    {isGenerating && (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    )}
                  </button>
                )}

                {/* Wallet Connection Status */}
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  ) : (
                    <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-16">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center text-gray-600">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">🔒</span>
                <span className="font-medium">Provably Fair Gaming</span>
              </div>
              <p className="text-sm">
                All games use Pyth Entropy for verifiable randomness on Linera Network
              </p>
            </div>
          </div>
        </footer>

        {/* VRF Status Modal */}
        {console.log('🔍 AppLayout render - showModal:', showModal)}
        <VRFStatusModal
          isOpen={showModal}
          onClose={closeModal}
          userAddress={address}
          vrfStatus={vrfStatus}
          onGenerateVRF={generateVRFBatch}
          isGenerating={isGenerating}
        />
      </div>
    </WalletConnectionHandler>
  );
};

export default AppLayout;
