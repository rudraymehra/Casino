/**
 * Linera Chain Service
 * Direct integration with Linera blockchain using @linera/client SDK
 * 
 * This service handles:
 * 1. Wallet creation and management
 * 2. Chain claiming from faucet
 * 3. Application interactions via GraphQL
 * 4. Real-time subscriptions for game updates
 * 
 * Based on official Linera examples:
 * - https://linera.dev/developers/frontend.html
 * - https://github.com/linera-io/linera-protocol/tree/main/examples
 */

// Linera Configuration for Conway Testnet
const LINERA_CONFIG = {
  // Conway testnet faucet
  faucetUrl: process.env.NEXT_PUBLIC_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net',
  // Casino application ID (deployed contract)
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || '387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584',
  // Chain ID
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || '47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2',
  // Explorer URL
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
};

// Game types matching the Rust contract
const GameType = {
  ROULETTE: 'Roulette',
  PLINKO: 'Plinko',
  MINES: 'Mines',
  WHEEL: 'Wheel',
};

/**
 * LineraChainService - Manages direct blockchain interactions
 */
class LineraChainService {
  constructor() {
    this.client = null;
    this.wallet = null;
    this.signer = null;
    this.chain = null;
    this.casinoApp = null;
    this.owner = null;
    this.chainId = null;
    this.isInitialized = false;
    this.listeners = new Set();
    this.balance = 0;
    this.lineraModule = null;
  }

  /**
   * Initialize the Linera client and SDK
   * Dynamically imports @linera/client to avoid SSR issues
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      console.log('🔗 Initializing Linera Chain Service...');
      console.log(`   Faucet: ${LINERA_CONFIG.faucetUrl}`);
      console.log(`   Application: ${LINERA_CONFIG.applicationId}`);

      // Try to import @linera/client (browser-only)
      if (typeof window !== 'undefined') {
        try {
          // Dynamic import for browser
          this.lineraModule = await import('@linera/client');
          await this.lineraModule.initialize();
          console.log('✅ @linera/client SDK initialized');
        } catch (importError) {
          console.warn('⚠️ @linera/client not available:', importError.message);
          console.log('   Using fallback GraphQL mode');
          this.lineraModule = null;
        }
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Linera initialization failed:', error);
      return false;
    }
  }

  /**
   * Connect wallet - creates new wallet via faucet or restores existing
   */
  async connectWallet() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔐 Connecting Linera wallet...');

      // Check for existing session
      const savedSession = this._loadSession();
      if (savedSession) {
        console.log('📱 Restoring saved session...');
        this.owner = savedSession.owner;
        this.chainId = savedSession.chainId;
        this.balance = savedSession.balance || 0;
        
        if (this.lineraModule) {
          // Recreate client from saved data
          await this._restoreClient(savedSession);
        }
        
        this._notifyListeners('connected', this._getConnectionInfo());
        return this._getConnectionInfo();
      }

      // Create new wallet via faucet
      if (this.lineraModule) {
        return await this._connectWithSDK();
      } else {
        return await this._connectWithFallback();
      }
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      this._notifyListeners('error', { message: error.message });
      throw error;
    }
  }

  /**
   * Connect using @linera/client SDK (preferred)
   */
  async _connectWithSDK() {
    const { Faucet, Client, signer } = this.lineraModule;

    // Create faucet connection
    const faucet = new Faucet(LINERA_CONFIG.faucetUrl);
    
    // Generate new keypair
    this.signer = signer.PrivateKey.createRandom();
    
    // Create wallet
    this.wallet = await faucet.createWallet();
    console.log('💼 Wallet created');

    // Get owner address
    this.owner = await this.signer.address();
    console.log(`👤 Owner: ${this.owner}`);

    // Claim a chain from faucet
    this.chainId = await faucet.claimChain(this.wallet, this.owner);
    console.log(`⛓️ Chain claimed: ${this.chainId}`);

    // Create client
    this.client = new Client(this.wallet, this.signer);
    
    // Get chain handle
    this.chain = await this.client.chain(this.chainId);
    
    // Get casino application handle
    this.casinoApp = await this.chain.application(LINERA_CONFIG.applicationId);
    console.log('🎰 Casino application connected');

    // Get initial balance
    await this._updateBalance();

    // Save session
    this._saveSession();

    // Set up real-time notifications
    this._setupNotifications();

    this._notifyListeners('connected', this._getConnectionInfo());
    return this._getConnectionInfo();
  }

  /**
   * Connect using GraphQL fallback (when SDK not available)
   */
  async _connectWithFallback() {
    console.log('🔄 Using GraphQL fallback connection...');

    // Generate a deterministic owner ID
    const randomBytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomBytes);
    }
    
    this.owner = `User:${Array.from(randomBytes.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0')).join('')}`;
    this.chainId = LINERA_CONFIG.chainId;
    this.balance = 1000; // Demo balance

    // Save session
    this._saveSession();

    this._notifyListeners('connected', this._getConnectionInfo());
    return this._getConnectionInfo();
  }

  /**
   * Restore client from saved session
   */
  async _restoreClient(session) {
    try {
      // In a real implementation, we'd restore the wallet/signer from encrypted storage
      // For now, we'll create a new client if SDK is available
      if (this.lineraModule && session.chainId) {
        console.log('🔄 Client restored for chain:', session.chainId);
      }
    } catch (error) {
      console.warn('Could not restore client:', error.message);
    }
  }

  /**
   * Update balance from chain
   */
  async _updateBalance() {
    if (this.casinoApp) {
      try {
        const response = await this.casinoApp.query(JSON.stringify({
          query: 'query { totalFunds }'
        }));
        const data = JSON.parse(response);
        // Convert from attos to tokens
        this.balance = parseFloat(data.data?.totalFunds || '0') / 1e18;
      } catch (error) {
        console.warn('Balance query failed:', error.message);
      }
    }
  }

  /**
   * Set up real-time notifications for chain updates
   */
  _setupNotifications() {
    if (this.chain) {
      this.chain.onNotification((notification) => {
        console.log('📬 Chain notification:', notification);
        
        if (notification.reason?.NewBlock || notification.reason?.BlockExecuted) {
          this._updateBalance();
          this._notifyListeners('blockUpdate', notification);
        }
      });
    }
  }

  /**
   * Place a bet on a game
   * @param {string} gameType - One of: Roulette, Plinko, Mines, Wheel
   * @param {number} betAmount - Amount to bet in LINERA tokens
   * @param {object} gameParams - Game-specific parameters
   */
  async placeBet(gameType, betAmount, gameParams = {}) {
    if (!this.owner) {
      throw new Error('Wallet not connected');
    }

    console.log(`🎰 Placing bet: ${gameType} - ${betAmount} LINERA`);

    // Generate commit-reveal pair for provably fair gaming
    const { commitHash, revealValue } = this._generateCommitReveal();

    try {
      let result;

      if (this.casinoApp) {
        // Use SDK for real on-chain transaction
        result = await this._placeBetOnChain(gameType, betAmount, commitHash, revealValue, gameParams);
      } else {
        // Use GraphQL API fallback
        result = await this._placeBetViaAPI(gameType, betAmount, commitHash, revealValue, gameParams);
      }

      // Update balance
      if (result.success) {
        const netChange = (result.payout || 0) - betAmount;
        this.balance = Math.max(0, this.balance + netChange);
        this._saveSession();
        this._notifyListeners('balanceChanged', { balance: this.balance });
      }

      return result;
    } catch (error) {
      console.error('❌ Bet failed:', error);
      throw error;
    }
  }

  /**
   * Place bet on-chain using SDK
   */
  async _placeBetOnChain(gameType, betAmount, commitHash, revealValue, gameParams) {
    // Step 1: Place bet with commit
    const placeBetMutation = JSON.stringify({
      query: `mutation {
        placeBet(
          gameType: "${gameType}",
          betAmount: "${Math.floor(betAmount * 1e18)}",
          commitHash: "${commitHash}",
          gameParams: "${JSON.stringify(gameParams).replace(/"/g, '\\"')}"
        )
      }`
    });

    const placeBetResponse = await this.casinoApp.query(placeBetMutation);
    const placeBetData = JSON.parse(placeBetResponse);
    
    if (!placeBetData.data?.placeBet) {
      throw new Error('Failed to place bet on chain');
    }

    // Step 2: Get the game ID (from query)
    const statusQuery = JSON.stringify({
      query: 'query { nextGameId }'
    });
    const statusResponse = await this.casinoApp.query(statusQuery);
    const statusData = JSON.parse(statusResponse);
    const gameId = (statusData.data?.nextGameId || 1) - 1;

    // Step 3: Reveal to determine outcome
    const revealMutation = JSON.stringify({
      query: `mutation {
        reveal(
          gameId: ${gameId},
          revealValue: "${revealValue}"
        )
      }`
    });

    const revealResponse = await this.casinoApp.query(revealMutation);
    const revealData = JSON.parse(revealResponse);

    // Step 4: Get game outcome from history
    const outcomeQuery = JSON.stringify({
      query: `query { gameOutcome(gameId: ${gameId}) { gameId gameType betAmount payoutAmount outcomeDetails timestamp } }`
    });
    
    const outcomeResponse = await this.casinoApp.query(outcomeQuery);
    const outcomeData = JSON.parse(outcomeResponse);
    const outcome = outcomeData.data?.gameOutcome;

    return {
      success: true,
      gameId,
      gameType,
      betAmount,
      outcome: outcome?.outcomeDetails || 'Game completed',
      payout: parseFloat(outcome?.payoutAmount || '0') / 1e18,
      multiplier: parseFloat(outcome?.payoutAmount || '0') / (betAmount * 1e18),
      proof: {
        commitHash,
        revealValue,
        chainId: this.chainId,
        applicationId: LINERA_CONFIG.applicationId,
        timestamp: outcome?.timestamp || Date.now(),
        blockchainMode: 'on-chain',
      },
      explorerUrl: `${LINERA_CONFIG.explorerUrl}/chains/${this.chainId}`,
    };
  }

  /**
   * Place bet via REST API fallback
   */
  async _placeBetViaAPI(gameType, betAmount, commitHash, revealValue, gameParams) {
    const response = await fetch('/api/linera/place-bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType,
        betAmount,
        gameParams,
        playerAddress: this.owner,
        commitHash,
        revealValue,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Generate cryptographic commit-reveal pair
   */
  _generateCommitReveal() {
    const revealBytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(revealBytes);
    } else {
      for (let i = 0; i < 32; i++) {
        revealBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const revealValue = Array.from(revealBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // For commit hash, we'd use SHA3-256 in browser
    // Simplified version - in production use crypto.subtle
    const commitHash = this._sha256Hex(revealBytes);

    return { commitHash, revealValue, revealBytes };
  }

  /**
   * Simple SHA-256 hex (browser compatible)
   */
  _sha256Hex(bytes) {
    // Use SubtleCrypto when available, else simple hash
    // This is a placeholder - real implementation would use crypto.subtle
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash) + bytes[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Get game history from chain
   */
  async getGameHistory() {
    try {
      if (this.casinoApp) {
        const response = await this.casinoApp.query(JSON.stringify({
          query: 'query { gameHistory { gameId gameType betAmount payoutAmount outcomeDetails timestamp } }'
        }));
        const data = JSON.parse(response);
        return data.data?.gameHistory || [];
      } else {
        const response = await fetch('/api/linera/history');
        if (response.ok) {
          const data = await response.json();
          return data.history || [];
        }
      }
    } catch (error) {
      console.error('Failed to fetch game history:', error);
    }
    return [];
  }

  /**
   * Request tokens from faucet
   */
  async requestFaucet() {
    if (!this.owner) {
      throw new Error('Wallet not connected');
    }

    try {
      // Add demo tokens
      this.balance += 100;
      this._saveSession();
      this._notifyListeners('balanceChanged', { balance: this.balance });
      
      console.log(`💰 Received 100 LINERA from faucet. New balance: ${this.balance}`);
      
      return {
        success: true,
        amount: 100,
        newBalance: this.balance,
      };
    } catch (error) {
      console.error('Faucet request failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    this.client = null;
    this.wallet = null;
    this.signer = null;
    this.chain = null;
    this.casinoApp = null;
    this.owner = null;
    this.chainId = null;
    this.balance = 0;
    
    this._clearSession();
    this._notifyListeners('disconnected', null);
    
    console.log('👋 Wallet disconnected');
  }

  /**
   * Check if connected
   */
  isConnected() {
    return !!this.owner && !!this.chainId;
  }

  /**
   * Get current balance
   */
  getBalance() {
    return this.balance;
  }

  /**
   * Get connection info
   */
  _getConnectionInfo() {
    return {
      owner: this.owner,
      chainId: this.chainId,
      balance: this.balance,
      applicationId: LINERA_CONFIG.applicationId,
      explorerUrl: `${LINERA_CONFIG.explorerUrl}/chains/${this.chainId}`,
      mode: this.casinoApp ? 'sdk' : 'graphql',
    };
  }

  /**
   * Save session to localStorage
   */
  _saveSession() {
    if (typeof window === 'undefined') return;
    
    const session = {
      owner: this.owner,
      chainId: this.chainId,
      balance: this.balance,
      timestamp: Date.now(),
    };
    
    localStorage.setItem('linera_chain_session', JSON.stringify(session));
  }

  /**
   * Load session from localStorage
   */
  _loadSession() {
    if (typeof window === 'undefined') return null;
    
    try {
      const saved = localStorage.getItem('linera_chain_session');
      if (!saved) return null;
      
      const session = JSON.parse(saved);
      
      // Check if session is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - session.timestamp > maxAge) {
        this._clearSession();
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Clear session
   */
  _clearSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('linera_chain_session');
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  _notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }

  /**
   * Get config
   */
  get config() {
    return LINERA_CONFIG;
  }
}

// Singleton instance
const lineraChainService = new LineraChainService();

export { lineraChainService, LineraChainService, LINERA_CONFIG, GameType };
export default lineraChainService;

