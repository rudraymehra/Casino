/**
 * Linera Blockchain Client (Server-Side)
 *
 * Server-side client that communicates with the Linera node service via HTTP/GraphQL.
 * This uses the `linera service` proxy (default port 8080) which exposes
 * application-level GraphQL endpoints at:
 *   {serviceUrl}/chains/{chainId}/applications/{applicationId}
 *
 * The public RPC (rpc.testnet-conway.linera.net) does NOT serve application GraphQL.
 * You must run `linera service --port 8080` locally for server-side operations.
 *
 * Casino contract GraphQL schema (from service.rs):
 *   Queries:  nextGameId, totalFunds, playerBalance(owner), gameHistory, gameOutcome(gameId)
 *   Mutations: deposit(amount), withdraw(amount), placeBet(gameType, betAmount, commitHash, gameParams), reveal(gameId, revealValue)
 */

import axios from 'axios';
import { LINERA_CONFIG } from '../config/lineraConfig.js';

export class LineraClient {
  constructor(config = {}) {
    this.serviceUrl = config.rpcUrl || LINERA_CONFIG.NETWORK.rpcUrl;
    this.chainId = config.chainId || LINERA_CONFIG.NETWORK.chainId;
    this.applicationId = config.applicationId || LINERA_CONFIG.NETWORK.applicationId;
    this.timeout = config.timeout || 10000;

    this.httpClient = axios.create({
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get the application-level GraphQL endpoint.
   * Requires `linera service` to be running.
   */
  getAppEndpoint() {
    return `${this.serviceUrl}/chains/${this.chainId}/applications/${this.applicationId}`;
  }

  /**
   * Execute a GraphQL query against the casino application.
   */
  async appQuery(query, variables = {}) {
    const endpoint = this.getAppEndpoint();
    try {
      const response = await this.httpClient.post(endpoint, { query, variables });

      if (response.data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to linera service at ${this.serviceUrl}. ` +
          'Make sure `linera service --port 8080` is running.'
        );
      }
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation against the casino application.
   * Linera mutations may return a block hash string on success.
   */
  async appMutation(mutation, variables = {}) {
    const endpoint = this.getAppEndpoint();
    try {
      const response = await this.httpClient.post(endpoint, {
        query: mutation,
        variables,
      });

      if (response.data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
      }

      // Linera mutations can return the block hash as a raw string
      if (typeof response.data.data === 'string') {
        return { blockHash: response.data.data, success: true };
      }

      return response.data.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to linera service at ${this.serviceUrl}. ` +
          'Make sure `linera service --port 8080` is running.'
        );
      }
      throw error;
    }
  }

  // ----- Casino Contract Queries -----

  async queryNextGameId() {
    const result = await this.appQuery('{ nextGameId }');
    return result?.nextGameId;
  }

  async queryTotalFunds() {
    const result = await this.appQuery('{ totalFunds }');
    return result?.totalFunds;
  }

  async queryPlayerBalance(owner) {
    const result = await this.appQuery(
      'query GetBalance($owner: String!) { playerBalance(owner: $owner) }',
      { owner }
    );
    const balanceAttos = result?.playerBalance || '0';
    return parseFloat(balanceAttos) / 1e18;
  }

  async queryGameHistory() {
    const result = await this.appQuery(`{
      gameHistory {
        gameId
        gameType
        betAmount
        payoutAmount
        outcomeDetails
        timestamp
      }
    }`);
    return result?.gameHistory || [];
  }

  async queryGameOutcome(gameId) {
    const result = await this.appQuery(
      'query GetOutcome($gameId: Int!) { gameOutcome(gameId: $gameId) }',
      { gameId: parseInt(gameId) }
    );
    return result?.gameOutcome;
  }

  // ----- Casino Contract Mutations -----

  async deposit(amount) {
    const amountAttos = Math.floor(parseFloat(amount) * 1e18).toString();
    return this.appMutation(
      'mutation Deposit($amount: String!) { deposit(amount: $amount) }',
      { amount: amountAttos }
    );
  }

  async withdraw(amount) {
    const amountAttos = Math.floor(parseFloat(amount) * 1e18).toString();
    return this.appMutation(
      'mutation Withdraw($amount: String!) { withdraw(amount: $amount) }',
      { amount: amountAttos }
    );
  }

  async placeBet(gameType, betAmount, commitHash, gameParams = '') {
    const amountAttos = Math.floor(parseFloat(betAmount) * 1e18).toString();
    return this.appMutation(
      `mutation PlaceBet($gameType: String!, $betAmount: String!, $commitHash: String!, $gameParams: String!) {
        placeBet(gameType: $gameType, betAmount: $betAmount, commitHash: $commitHash, gameParams: $gameParams)
      }`,
      {
        gameType,
        betAmount: amountAttos,
        commitHash,
        gameParams: typeof gameParams === 'string' ? gameParams : JSON.stringify(gameParams),
      }
    );
  }

  async reveal(gameId, revealValue) {
    return this.appMutation(
      'mutation Reveal($gameId: Int!, $revealValue: String!) { reveal(gameId: $gameId, revealValue: $revealValue) }',
      { gameId: parseInt(gameId), revealValue }
    );
  }

  // ----- Game Logging -----

  /**
   * Log a game result to the blockchain.
   * Uses the casino contract's mutation interface.
   */
  async logGameResult(gameData) {
    try {
      const lineraGameData = LINERA_CONFIG.formatGameDataForLinera(gameData);

      // The casino contract doesn't have a dedicated "log" mutation.
      // Game results are recorded through placeBet + reveal flow.
      // For logging purposes, we query the outcome after the game is resolved.
      const gameId = gameData.gameId;
      if (gameId != null) {
        const outcome = await this.queryGameOutcome(gameId);
        return {
          success: true,
          chainId: this.chainId,
          gameId,
          outcome,
          explorerUrl: LINERA_CONFIG.getBlockExplorerUrl(this.chainId, null),
          timestamp: Date.now(),
        };
      }

      return {
        success: false,
        error: 'No gameId provided for logging',
      };
    } catch (error) {
      console.error('Failed to log game result:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ----- Health / Status -----

  /**
   * Check if the linera service is reachable and the application endpoint is available.
   */
  async healthCheck() {
    const endpoint = this.getAppEndpoint();
    try {
      const response = await this.httpClient.post(endpoint, {
        query: '{ __typename }',
      });
      return {
        serviceReachable: true,
        appAvailable: !response.data.errors,
        endpoint,
      };
    } catch (error) {
      return {
        serviceReachable: false,
        appAvailable: false,
        endpoint,
        error: error.message,
      };
    }
  }
}

export default LineraClient;
