/**
 * Treasury Configuration for Linera Casino
 * Note: This is a simplified config for the Linera integration
 */

export const TREASURY_CONFIG = {
  // Treasury wallet address (for demo purposes)
  ADDRESS: '0x0000000000000000000000000000000000000000',
  
  // Network configuration (Linera testnet)
  NETWORK: {
    CHAIN_ID: '0x1', // Placeholder - Linera uses different chain model
    CHAIN_NAME: 'Linera Testnet',
    RPC_URL: 'http://localhost:8080',
    EXPLORER_URL: 'https://explorer.testnet-conway.linera.net',
  },
  
  // Deposit/Withdrawal limits
  LIMITS: {
    MIN_DEPOSIT: 1,
    MAX_DEPOSIT: 10000,
    MIN_WITHDRAW: 1,
    MAX_WITHDRAW: 5000,
  },
  
  // Gas configuration
  GAS: {
    DEPOSIT_LIMIT: '0x5208', // 21000 in hex
    WITHDRAW_LIMIT: '0x5208',
  },
};

export default TREASURY_CONFIG;

