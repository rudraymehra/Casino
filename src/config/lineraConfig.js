/**
 * Linera Blockchain Configuration
 * Linera fast game logic entegrasyonu için konfigürasyon
 */

export const LINERA_CONFIG = {
  // Linera Network Configuration
  NETWORK: {
    name: 'Linera Testnet',
    rpcUrl: process.env.NEXT_PUBLIC_LINERA_RPC || 'http://localhost/graphql',
    explorerUrl: process.env.NEXT_PUBLIC_LINERA_EXPLORER || 'https://explorer.testnet-conway.linera.net',
    faucetUrl: process.env.NEXT_PUBLIC_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net',
    chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65',
    applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || 'e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65030000000000000000000000',
    currency: 'LINERA',
    currencySymbol: 'LINERA',
    currencyDecimals: 18
  },

  // Game Logger Application Configuration
  GAME_LOGGER_CONFIG: {
    // Application permissions
    permissions: {
      canCreateChains: true,
      canSendMessages: true,
      canExecuteOperations: true
    },
    
    // Game types supported (Linera'da enum olarak)
    gameTypes: {
      MINES: 0,
      PLINKO: 1,
      ROULETTE: 2,
      WHEEL: 3,
      DICE: 4,
      CRASH: 5
    },

    // Fast game logic configuration
    fastGameConfig: {
      // Temporary chain için fee budget
      feebudget: '1000000', // 1 LINERA
      // Block confirmation timeout
      blockTimeout: 5000, // 5 seconds
      // Message timeout
      messageTimeout: 10000, // 10 seconds
      // Max retries
      maxRetries: 3
    }
  },

  // Operations for game logging
  OPERATIONS: {
    LOG_GAME_RESULT: 'LogGameResult',
    CREATE_GAME_SESSION: 'CreateGameSession',
    END_GAME_SESSION: 'EndGameSession',
    UPDATE_PLAYER_STATS: 'UpdatePlayerStats'
  },

  // Message types
  MESSAGE_TYPES: {
    GAME_STARTED: 'GameStarted',
    GAME_ENDED: 'GameEnded',
    RESULT_LOGGED: 'ResultLogged'
  },

  /**
   * Get network configuration
   * @returns {Object} Network configuration
   */
  getNetworkConfig() {
    return this.NETWORK;
  },

  /**
   * Get game logger application configuration
   * @returns {Object} Game logger configuration
   */
  getGameLoggerConfig() {
    return this.GAME_LOGGER_CONFIG;
  },

  /**
   * Get explorer URL for chain
   * @param {string} chainId - Chain ID
   * @returns {string} Explorer URL
   */
  getExplorerUrl(chainId) {
    return `${this.NETWORK.explorerUrl}/chain/${chainId}`;
  },

  /**
   * Get explorer URL for block
   * @param {string} chainId - Chain ID
   * @param {number} blockHeight - Block height
   * @returns {string} Explorer URL
   */
  getBlockExplorerUrl(chainId, blockHeight) {
    return `${this.NETWORK.explorerUrl}/chain/${chainId}/block/${blockHeight}`;
  },

  /**
   * Get game type enum value
   * @param {string} gameType - Game type name
   * @returns {number} Game type enum value
   */
  getGameTypeEnum(gameType) {
    return this.GAME_LOGGER_CONFIG.gameTypes[gameType.toUpperCase()] || 0;
  },

  /**
   * Create game data structure for Linera
   * @param {Object} gameData - Game data
   * @returns {Object} Formatted game data for Linera
   */
  formatGameDataForLinera(gameData) {
    return {
      gameType: this.getGameTypeEnum(gameData.gameType),
      playerAddress: gameData.playerAddress,
      betAmount: gameData.betAmount.toString(),
      payout: gameData.payout.toString(),
      gameResult: {
        outcome: gameData.gameResult.outcome,
        multiplier: gameData.gameResult.multiplier || 0,
        details: gameData.gameResult.details || {}
      },
      entropyProof: {
        randomValue: gameData.entropyProof.randomValue,
        provider: gameData.entropyProof.provider,
        sequence: gameData.entropyProof.sequence,
        blockHash: gameData.entropyProof.blockHash
      },
      timestamp: gameData.timestamp || Date.now(),
      sessionId: gameData.sessionId || `session_${Date.now()}`
    };
  },

  /**
   * Validate game data before logging
   * @param {Object} gameData - Game data to validate
   * @returns {boolean} True if valid
   */
  validateGameData(gameData) {
    const required = ['gameType', 'playerAddress', 'betAmount', 'payout', 'gameResult', 'entropyProof'];
    return required.every(field => gameData[field] !== undefined && gameData[field] !== null);
  }
};

export default LINERA_CONFIG;