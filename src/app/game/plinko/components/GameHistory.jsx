"use client";
import { useState } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";

// Linera Configuration
const LINERA_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd',
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
};

export default function GameHistory({ history }) {
  const [visibleCount, setVisibleCount] = useState(5);

  // Open Linera Explorer link
  const openLineraExplorer = (chainId) => {
    const targetChainId = chainId || LINERA_CONFIG.chainId;
    const explorerUrl = `${LINERA_CONFIG.explorerUrl}/chains/${targetChainId}`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Game History</h3>
        {history.length > visibleCount && (
          <button
            onClick={() => setVisibleCount((c) => Math.min(c + 5, history.length))}
            className="bg-[#2A0025] border border-[#333947] rounded-lg px-3 py-2 text-sm text-white hover:bg-[#3A0035] transition-colors"
          >
            Show more
          </button>
        )}
      </div>

      {/* Game History Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#333947]">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                Game
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                Title
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                Bet amount
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                Multiplier
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                Payout
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">
                Linera Proof
              </th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, visibleCount).map((game, index) => (
              <tr key={`${game.id}-${index}`} className="border-b border-[#333947]/30 hover:bg-[#2A0025]/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">P</span>
                    </div>
                    <span className="text-white text-sm">Plinko</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-gray-300 text-sm">{game.title}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                    <span className="text-white text-sm">{game.betAmount}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-gray-300 text-sm">{game.multiplier}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                    <span className="text-white text-sm">{game.payout}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    {game.entropyProof || game.lineraChainId || game.lineraExplorerUrl ? (
                      <>
                        <div className="text-xs text-gray-300 font-mono">
                          <div className="text-yellow-400 font-bold">
                            {game.entropyProof?.sequenceNumber && game.entropyProof.sequenceNumber !== '0'
                              ? String(game.entropyProof.sequenceNumber)
                              : game.lineraChainId
                                ? `Chain: ${game.lineraChainId.slice(0, 8)}...`
                                : ''}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const url = game.lineraExplorerUrl ||
                                         game.entropyProof?.lineraExplorerUrl ||
                                         `${LINERA_CONFIG.explorerUrl}/chains/${game.lineraChainId || LINERA_CONFIG.chainId}`;
                              window.open(url, '_blank');
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded text-[#3B82F6] text-xs hover:bg-[#3B82F6]/20 transition-colors"
                          >
                            <FaExternalLinkAlt size={8} />
                            Linera
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openLineraExplorer(game.lineraChainId)}
                          className="flex items-center gap-1 px-2 py-1 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded text-[#3B82F6] text-xs hover:bg-[#3B82F6]/20 transition-colors"
                        >
                          <FaExternalLinkAlt size={8} />
                          Linera
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-[#2A0025] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-gray-400">📊</span>
          </div>
          <p className="text-gray-400 text-sm">No games played yet</p>
          <p className="text-gray-500 text-xs mt-1">Start playing to see your game history</p>
        </div>
      )}

      <div className="mt-4 text-center text-gray-400 text-sm">
        Showing {Math.min(visibleCount, history.length)} of {history.length} entries
      </div>
    </div>
  );
}
