/**
 * Linera Game Logger Service
 * Logs game results to the Linera blockchain via LineraClient.
 *
 * Requires `linera service --port 8080` to be running for server-side operations.
 */

import LineraClient from './LineraClient.js';
import { LINERA_CONFIG } from '../config/lineraConfig.js';

export class LineraGameLoggerService {
  constructor() {
    this.client = new LineraClient();
    this.isInitialized = false;
  }

  /**
   * Initialize the service by testing connectivity to linera service.
   */
  async initialize() {
    try {
      const health = await this.client.healthCheck();
      if (health.serviceReachable) {
        console.log('Linera Game Logger Service initialized:', health);
        this.isInitialized = true;
        return true;
      }
      console.error('Linera service not reachable:', health.error || health.endpoint);
      this.isInitialized = false;
      return false;
    } catch (error) {
      console.error('Linera network not available:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Start a new game session.
   * Returns session metadata from the blockchain or throws if unavailable.
   */
  async startGameSession(gameConfig) {
    if (!this.isInitialized) {
      throw new Error(
        'Linera Game Logger Service not initialized. ' +
        'Ensure `linera service --port 8080` is running and call initialize() first.'
      );
    }

    const sessionId = `${gameConfig.gameType}_${gameConfig.playerAddress}_${Date.now()}`;

    // Query the next game ID from the contract to confirm connectivity
    try {
      const nextGameId = await this.client.queryNextGameId();
      return {
        success: true,
        sessionId,
        nextGameId,
        chainId: this.client.chainId,
      };
    } catch (error) {
      console.error('Failed to start Linera game session:', error.message);
      throw new Error(`Failed to start game session: ${error.message}`);
    }
  }

  /**
   * Log a game result to Linera.
   * Propagates errors rather than returning fake success.
   */
  async logGameResult(gameData) {
    if (!this.isInitialized) {
      throw new Error('Linera Game Logger Service not initialized');
    }

    if (!LINERA_CONFIG.validateGameData(gameData)) {
      throw new Error('Invalid game data structure');
    }

    const result = await this.client.logGameResult(gameData);

    if (result.success) {
      console.log('Game result logged to Linera:', {
        chainId: result.chainId,
        gameId: result.gameId,
      });
      return result;
    }

    throw new Error(result.error || 'Failed to log game result');
  }

  /**
   * End a game session.
   */
  async endGameSession(sessionId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized - cannot end session');
    }
    return { success: true, sessionId, message: 'Session ended' };
  }

  /**
   * Check if service is ready.
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get service status.
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      serviceUrl: this.client.serviceUrl,
      chainId: this.client.chainId,
      applicationId: this.client.applicationId,
    };
  }
}

// Export singleton instance
export const lineraGameLogger = new LineraGameLoggerService();
export default lineraGameLogger;
