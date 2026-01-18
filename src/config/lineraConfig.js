/**
 * Linera Blockchain Configuration
 * APT Casino Linera integration configuration
 */

// Deployed Casino Contract Info
const DEPLOYED_CONTRACT = {
  chainId: '47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2',
  applicationId: '387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584',
  deployedAt: '2026-01-13T15:39:57Z',
  sdkVersion: '0.15.8',
};

export const LINERA_CONFIG = {
  // Linera Network Configuration
  NETWORK: {
    name: 'Linera Conway Testnet',
    rpcUrl: process.env.NEXT_PUBLIC_LINERA_RPC || 'https://testnet-conway.linera.net',
    explorerUrl: process.env.NEXT_PUBLIC_LINERA_EXPLORER || 'https://explorer.testnet-conway.linera.net',
    faucetUrl: process.env.NEXT_PUBLIC_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net',
    chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || DEPLOYED_CONTRACT.chainId,
    applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || DEPLOYED_CONTRACT.applicationId,
    currency: 'LINERA',
    currencySymbol: 'LINERA',
    currencyDecimals: 18
  },

  // Casino Contract Configuration
  CASINO_CONTRACT: {
    ...DEPLOYED_CONTRACT,
    games: ['Roulette', 'Plinko', 'Mines', 'Wheel'],
    
    // Game types for GraphQL mutations
    gameTypes: {
      ROULETTE: 'Roulette',
      PLINKO: 'Plinko', 
      MINES: 'Mines',
      WHEEL: 'Wheel',
    },

    // Bet configuration
    minBet: '1000000000000000000', // 1 LINERA in attos
    maxBet: '100000000000000000000', // 100 LINERA in attos
  },

  // Game-specific configuration
  GAME_CONFIG: {
    ROULETTE: {
      betTypes: ['number', 'color', 'odd_even', 'high_low'],
      numbers: Array.from({ length: 37 }, (_, i) => i),
      payouts: {
        straight: 36,
        color: 2,
        odd_even: 2,
        high_low: 2,
      },
    },
    PLINKO: {
      minRows: 8,
      maxRows: 16,
      defaultRows: 12,
    },
    MINES: {
      gridSize: 25,
      minMines: 1,
      maxMines: 24,
      defaultMines: 5,
    },
    WHEEL: {
      segments: 8,
      multipliers: [2, 1.5, 3, 0, 5, 2, 10, 1],
    },
  },

  // Commit-reveal configuration
  COMMIT_REVEAL: {
    hashAlgorithm: 'sha3-256',
    revealTimeout: 300000, // 5 minutes in ms
    commitSize: 32, // bytes
  },

  // Transaction configuration
  TX_CONFIG: {
    gasLimit: '1000000',
    confirmationBlocks: 1,
    timeout: 30000, // 30 seconds
    maxRetries: 3,
  },

  /**
   * Get the GraphQL endpoint for the casino application
   */
  getGraphQLEndpoint() {
    return `${this.NETWORK.rpcUrl}/chains/${this.NETWORK.chainId}/applications/${this.NETWORK.applicationId}`;
  },

  /**
   * Get explorer URL for a transaction
   */
  getExplorerUrl(txHash) {
    return `${this.NETWORK.explorerUrl}/chains/${this.NETWORK.chainId}/block/${txHash}`;
  },

  /**
   * Get explorer URL for the chain
   */
  getChainExplorerUrl() {
    return `${this.NETWORK.explorerUrl}/chains/${this.NETWORK.chainId}`;
  },

  /**
   * Get explorer URL for the application
   */
  getApplicationExplorerUrl() {
    return `${this.NETWORK.explorerUrl}/applications/${this.NETWORK.applicationId}`;
  },

  /**
   * Convert tokens to attos
   */
  tokensToAttos(tokens) {
    return BigInt(Math.floor(parseFloat(tokens) * 10 ** 18)).toString();
  },

  /**
   * Convert attos to tokens
   */
  attosToTokens(attos) {
    return (BigInt(attos) / BigInt(10 ** 18)).toString();
  },

  /**
   * Format game params for contract call
   */
  formatGameParams(gameType, params) {
    switch (gameType) {
      case 'Roulette':
        return `${params.betType}:${params.betValue}`;
      case 'Plinko':
        return `${params.rows || 12}`;
      case 'Mines':
        return `${params.numMines || 5}:${params.revealed || 0}`;
      case 'Wheel':
        return '';
      default:
        return '';
    }
  },

  /**
   * Parse game outcome from contract response
   */
  parseGameOutcome(outcomeString) {
    const parts = outcomeString.split(':');
    return {
      game: parts[0]?.trim(),
      result: parts[1]?.trim(),
      details: parts.slice(2).join(':').trim(),
    };
  },

  /**
   * Validate game data structure
   */
  validateGameData(gameData) {
    if (!gameData) return false;
    
    // Check required fields
    const requiredFields = ['gameType', 'playerAddress', 'betAmount'];
    for (const field of requiredFields) {
      if (gameData[field] === undefined || gameData[field] === null) {
        console.warn(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // Validate game type
    const validGameTypes = Object.values(this.CASINO_CONTRACT.gameTypes);
    if (!validGameTypes.includes(gameData.gameType)) {
      console.warn(`Invalid game type: ${gameData.gameType}`);
      return false;
    }
    
    // Validate bet amount is a positive number
    const betAmount = parseFloat(gameData.betAmount);
    if (isNaN(betAmount) || betAmount <= 0) {
      console.warn(`Invalid bet amount: ${gameData.betAmount}`);
      return false;
    }
    
    return true;
  },

  /**
   * Format game data for Linera blockchain logging
   */
  formatGameDataForLinera(gameData) {
    return {
      gameType: gameData.gameType,
      playerAddress: gameData.playerAddress,
      betAmount: this.tokensToAttos(gameData.betAmount),
      payout: gameData.payout ? this.tokensToAttos(gameData.payout) : '0',
      outcome: gameData.outcome || 'unknown',
      timestamp: gameData.timestamp || new Date().toISOString(),
      gameParams: gameData.gameParams || {},
      chainId: this.NETWORK.chainId,
      applicationId: this.NETWORK.applicationId,
    };
  },
};

export default LINERA_CONFIG;
