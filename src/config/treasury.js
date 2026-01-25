/**
 * Treasury Configuration for Linera Casino
 * REAL BLOCKCHAIN INTEGRATION
 */

// Deployed Casino Contract - MUST match .env.local
const DEPLOYED_CONTRACT = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || 'e230e675d2ade7ac7c3351d57c7dff2ff59c7ade94cb615ebe77149113b6d194',
  deployedAt: '2026-01-25T00:00:00Z',
};

export const TREASURY_CONFIG = {
  // Casino contract address (Linera application ID)
  ADDRESS: DEPLOYED_CONTRACT.applicationId,

  // Network configuration (Linera Conway Testnet)
  NETWORK: {
    CHAIN_ID: DEPLOYED_CONTRACT.chainId,
    CHAIN_NAME: 'Linera Conway Testnet',
    RPC_URL: process.env.NEXT_PUBLIC_LINERA_RPC || 'https://rpc.testnet-conway.linera.net',
    FAUCET_URL: process.env.NEXT_PUBLIC_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net',
    EXPLORER_URL: 'https://explorer.testnet-conway.linera.net',
  },

  // Contract info
  CONTRACT: {
    ...DEPLOYED_CONTRACT,
    applicationEndpoint: `https://rpc.testnet-conway.linera.net/chains/${DEPLOYED_CONTRACT.chainId}/applications/${DEPLOYED_CONTRACT.applicationId}`,
  },

  // Deposit/Withdrawal limits (in LINERA)
  LIMITS: {
    MIN_DEPOSIT: 0.001,
    MAX_DEPOSIT: 10000,
    MIN_WITHDRAW: 0.001,
    MAX_WITHDRAW: 5000,
  },

  // Token configuration
  TOKEN: {
    name: 'LINERA',
    symbol: 'LINERA',
    decimals: 18,
    // Convert human-readable to attos (smallest unit)
    toAttos: (amount) => Math.floor(parseFloat(amount) * 1e18).toString(),
    // Convert attos to human-readable
    fromAttos: (attos) => parseFloat(attos) / 1e18,
  },

  // Explorer URLs
  getChainExplorerUrl: () =>
    `${TREASURY_CONFIG.NETWORK.EXPLORER_URL}/chains/${DEPLOYED_CONTRACT.chainId}`,

  getApplicationExplorerUrl: () =>
    `${TREASURY_CONFIG.NETWORK.EXPLORER_URL}/applications/${DEPLOYED_CONTRACT.applicationId}`,

  getTransactionExplorerUrl: (txHash) =>
    `${TREASURY_CONFIG.NETWORK.EXPLORER_URL}/chains/${DEPLOYED_CONTRACT.chainId}/block/${txHash}`,
};

export default TREASURY_CONFIG;
