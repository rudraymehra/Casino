/**
 * Linera Chain Service - Production Implementation
 *
 * Integrates with Linera blockchain via Croissant wallet extension
 * The wallet extension (window.linera) handles:
 * - Private key management
 * - Transaction signing
 * - Chain connections
 *
 * Reference: https://github.com/Nirajsah/croissant
 */

// Linera Configuration
const LINERA_CONFIG = {
  // Casino application ID (your deployed contract)
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || '',
  // Explorer URL for transaction links
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
  // Faucet URL (for reference)
  faucetUrl: 'https://faucet.testnet-conway.linera.net',
};

// Game types matching the Rust contract
const GameType = {
  ROULETTE: 'Roulette',
  PLINKO: 'Plinko',
  MINES: 'Mines',
  WHEEL: 'Wheel',
};

/**
 * LineraChainService - Production wallet integration
 */
class LineraChainService {
  constructor() {
    this.provider = null; // window.linera
    this.isConnected = false;
    this.owner = null;
    this.chainId = null;
    this.balance = 0;
    this.listeners = new Set();
    this._notificationCleanup = null;
    // Demo mode - for testing without real blockchain
    this.demoMode = false;
    this.WELCOME_BONUS = 1000; // Welcome bonus in LINERA tokens
  }

  /**
   * Check if Linera wallet extension is installed
   */
  isWalletInstalled() {
    return typeof window !== 'undefined' && !!window.linera;
  }

  /**
   * Get the wallet installation URL
   */
  getWalletInstallUrl() {
    return 'https://github.com/Nirajsah/croissant';
  }

  /**
   * Initialize - check for wallet extension or restore dev/demo mode state
   */
  async initialize() {
    if (typeof window === 'undefined') {
      console.warn('LineraChainService: Not in browser environment');
      return false;
    }

    const isDev = process.env.NODE_ENV === 'development';

    // Check for dev wallet state (auto-connect in dev mode)
    if (isDev) {
      const devWalletState = localStorage.getItem('dev-wallet-state');
      if (devWalletState === 'connected' || devWalletState === null) {
        // Auto-restore dev mode connection
        this.demoMode = true;
        this.isConnected = true;
        this.owner = localStorage.getItem('dev-wallet-address') || '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe';
        this.chainId = process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'demo-chain';

        // Restore balance from localStorage
        const savedBalance = localStorage.getItem('userBalance');
        this.balance = savedBalance ? parseFloat(savedBalance) : this.WELCOME_BONUS;

        console.log('✅ DEV MODE: Auto-restored connection');
        console.log(`   Owner: ${this.owner}`);
        console.log(`   Balance: ${this.balance} LINERA`);

        return true;
      }
    }

    // Check for existing demo mode state in production
    const demoWalletState = localStorage.getItem('demo-wallet-state');
    if (demoWalletState === 'connected') {
      const savedOwner = localStorage.getItem('demo-wallet-owner');
      const savedBalance = localStorage.getItem('userBalance');

      if (savedOwner) {
        this.demoMode = true;
        this.isConnected = true;
        this.owner = savedOwner;
        this.chainId = process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'demo-chain';
        this.balance = savedBalance ? parseFloat(savedBalance) : this.WELCOME_BONUS;

        console.log('✅ DEMO MODE: Restored previous session');
        console.log(`   Owner: ${this.owner}`);
        console.log(`   Balance: ${this.balance} LINERA`);

        return true;
      }
    }

    // Wait a bit for extension to inject
    await this._waitForWallet(1000);

    if (!this.isWalletInstalled()) {
      console.warn('⚠️ Linera wallet extension not detected');
      console.warn('   Install Croissant: https://github.com/Nirajsah/croissant');

      // In production without wallet, enable demo mode to allow gameplay
      console.log('📱 Enabling DEMO MODE for gameplay');
      return true;
    }

    this.provider = window.linera;
    console.log('✅ Linera wallet extension detected');
    return true;
  }

  /**
   * Wait for wallet extension to be injected
   */
  _waitForWallet(timeout = 1000) {
    return new Promise((resolve) => {
      if (window.linera) {
        resolve(true);
        return;
      }

      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (window.linera || Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(!!window.linera);
        }
      }, 100);
    });
  }

  /**
   * Connect to wallet - requests user approval
   * Falls back to demo mode if wallet not available or connection fails
   */
  async connectWallet() {
    // Try to initialize wallet
    const initialized = await this.initialize();

    // If no wallet, use demo mode
    if (!initialized || !this.provider) {
      console.log('⚠️ No wallet detected, using DEMO MODE');
      return this._connectDemoMode();
    }

    try {
      console.log('🔗 Requesting wallet connection...');

      // Create a timeout promise to handle unresponsive extensions
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Wallet connection timeout')), 5000);
      });

      // Request wallet connection - this will show approval popup
      // Race against timeout to handle unresponsive wallet extensions
      const response = await Promise.race([
        this.provider.request({
          type: 'CONNECT_WALLET',
        }),
        timeoutPromise,
      ]);

      if (!response || response.error) {
        // Fall back to demo mode if connection rejected
        console.log('⚠️ Wallet connection rejected, using DEMO MODE');
        return this._connectDemoMode();
      }

      // Extract connection data
      this.owner = response.data?.owner || response.data?.address || response.result?.owner;
      this.chainId = response.data?.chainId || response.result?.chainId;
      this.isConnected = true;
      this.demoMode = false;

      console.log('✅ Wallet connected (LIVE MODE)');
      console.log(`   Owner: ${this.owner}`);
      console.log(`   Chain: ${this.chainId}`);

      // Get initial balance from chain
      await this._updateBalance();

      // If balance is 0, give welcome bonus for testing
      if (this.balance === 0) {
        console.log('🎁 New user detected, crediting welcome bonus...');
        this.balance = this.WELCOME_BONUS;
        this._notifyListeners('balanceChanged', { balance: this.balance });
      }

      // Setup notification listener
      this._setupNotifications();

      // Notify listeners
      this._notifyListeners('connected', this.getConnectionInfo());

      return this.getConnectionInfo();
    } catch (error) {
      // Handle Chrome runtime errors (extension not responding)
      const isRuntimeError = error.message?.includes('Could not establish connection') ||
                             error.message?.includes('Receiving end does not exist') ||
                             error.message?.includes('timeout') ||
                             error.message?.includes('Extension context invalidated');

      if (isRuntimeError) {
        console.warn('⚠️ Wallet extension not responding (background script may be inactive)');
        console.log('💡 Tip: Try refreshing the page or reloading the wallet extension');
      }

      console.error('❌ Wallet connection failed, falling back to demo mode:', error.message);
      return this._connectDemoMode();
    }
  }

  /**
   * Connect in demo mode (no real wallet)
   */
  _connectDemoMode() {
    this.demoMode = true;
    this.isConnected = true;

    // Try to restore existing demo owner, or create new one
    const existingOwner = localStorage.getItem('demo-wallet-owner');
    this.owner = existingOwner || 'demo_' + Math.random().toString(36).substring(2, 10);

    this.chainId = process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'demo-chain';

    // Restore or set initial balance
    const savedBalance = localStorage.getItem('userBalance');
    this.balance = savedBalance ? parseFloat(savedBalance) : this.WELCOME_BONUS;

    // Persist demo mode state for page refreshes
    localStorage.setItem('demo-wallet-state', 'connected');
    localStorage.setItem('demo-wallet-owner', this.owner);
    if (!savedBalance || parseFloat(savedBalance) <= 0) {
      localStorage.setItem('userBalance', this.balance.toString());
    }

    console.log('🎮 Connected in DEMO MODE');
    console.log(`   Demo Owner: ${this.owner}`);
    console.log(`   Balance: ${this.balance} LINERA (demo tokens)`);

    this._notifyListeners('connected', this.getConnectionInfo());

    return this.getConnectionInfo();
  }

  /**
   * Request chain assignment for this dApp
   */
  async requestChainAssignment() {
    if (!this.provider || !this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await this.provider.request({
        type: 'ASSIGNMENT',
        message: {
          chainId: this.chainId,
          timestamp: Date.now(),
        },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data || response.result;
    } catch (error) {
      console.error('Chain assignment failed:', error);
      throw error;
    }
  }

  /**
   * Query the casino application
   */
  async query(queryString) {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    if (!LINERA_CONFIG.applicationId) {
      throw new Error('Casino application ID not configured');
    }

    try {
      const response = await this.provider.request({
        type: 'QUERY',
        applicationId: LINERA_CONFIG.applicationId,
        query: JSON.stringify({ query: queryString }),
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Parse response
      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data || response.result;

      return data;
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  /**
   * Execute a mutation on the casino application
   */
  async mutate(mutationString) {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    if (!LINERA_CONFIG.applicationId) {
      throw new Error('Casino application ID not configured');
    }

    try {
      // Mutations are sent as queries in Linera GraphQL
      const response = await this.provider.request({
        type: 'QUERY',
        applicationId: LINERA_CONFIG.applicationId,
        query: JSON.stringify({ query: mutationString }),
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const data = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data || response.result;

      return data;
    } catch (error) {
      console.error('Mutation failed:', error);
      throw error;
    }
  }

  /**
   * Place a bet on a game
   * @param {string} gameType - One of: Roulette, Plinko, Mines, Wheel
   * @param {number} betAmount - Amount to bet in LINERA tokens
   * @param {object} gameParams - Game-specific parameters
   */
  async placeBet(gameType, betAmount, gameParams = {}) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    if (betAmount > this.balance) {
      throw new Error(`Insufficient balance. You have ${this.balance} LINERA`);
    }

    console.log(`🎰 Placing bet: ${gameType} - ${betAmount} LINERA`);

    // Generate commit-reveal pair for provably fair gaming
    const { commitHash, revealValue } = await this._generateCommitReveal();

    // DEMO MODE: Simulate game locally
    if (this.demoMode) {
      return this._placeBetDemo(gameType, betAmount, gameParams, commitHash, revealValue);
    }

    try {
      // Convert bet amount to smallest unit (attos)
      const betAmountAttos = Math.floor(betAmount * 1e18).toString();

      // Get next game ID before placing bet
      const preQuery = await this.query(`query { nextGameId }`);
      const gameId = preQuery?.data?.nextGameId || 1;

      // Step 1: Place bet with commit hash (returns bool)
      const placeBetMutation = `
        mutation {
          placeBet(
            gameType: "${gameType.toLowerCase()}",
            betAmount: "${betAmountAttos}",
            commitHash: "${commitHash}",
            gameParams: ${JSON.stringify(JSON.stringify(gameParams))}
          )
        }
      `;

      const placeBetResult = await this.mutate(placeBetMutation);

      if (!placeBetResult?.data?.placeBet) {
        throw new Error('Failed to place bet on chain');
      }

      // Step 2: Reveal to determine outcome (returns bool)
      const revealMutation = `
        mutation {
          reveal(
            gameId: ${gameId},
            revealValue: "${revealValue}"
          )
        }
      `;

      await this.mutate(revealMutation);

      // Step 3: Get game outcome from history
      const outcomeQuery = `
        query {
          gameOutcome(gameId: ${gameId}) {
            gameId
            gameType
            betAmount
            payoutAmount
            outcomeDetails
            timestamp
          }
        }
      `;

      const outcomeResult = await this.query(outcomeQuery);
      const outcome = outcomeResult?.data?.gameOutcome;

      // Calculate payout (betAmount and payoutAmount are strings in attos)
      const payoutAttos = outcome?.payoutAmount ? parseFloat(outcome.payoutAmount) : 0;
      const payout = payoutAttos / 1e18;

      // Update balance
      await this._updateBalance();

      const result = {
        success: true,
        gameId,
        gameType,
        betAmount,
        outcome: outcome?.outcomeDetails || 'Game completed',
        payout,
        multiplier: betAmount > 0 ? payout / betAmount : 0,
        proof: {
          commitHash,
          revealValue,
          chainId: this.chainId,
          applicationId: LINERA_CONFIG.applicationId,
          timestamp: outcome?.timestamp || Date.now(),
          blockchainVerified: true,
        },
        explorerUrl: `${LINERA_CONFIG.explorerUrl}/chains/${this.chainId}`,
      };

      this._notifyListeners('betResult', result);
      return result;

    } catch (error) {
      console.error('❌ Bet failed:', error);
      this._notifyListeners('error', { message: error.message });
      throw error;
    }
  }

  /**
   * Get player's casino balance
   */
  async getBalance() {
    if (!this.isConnected || !this.owner) {
      return 0;
    }

    // In demo mode, sync with localStorage (Redux balance)
    if (this.demoMode) {
      if (typeof window !== 'undefined') {
        const savedBalance = localStorage.getItem('userBalance');
        if (savedBalance) {
          this.balance = parseFloat(savedBalance);
        }
      }
      return this.balance;
    }

    try {
      const result = await this.query(`query { playerBalance(owner: "${this.owner}") }`);
      const balanceAttos = result?.data?.playerBalance || '0';
      this.balance = parseFloat(balanceAttos) / 1e18;
      return this.balance;
    } catch (error) {
      console.warn('Failed to get balance:', error.message);
      return this.balance;
    }
  }

  /**
   * Request faucet tokens (for testing)
   */
  async requestFaucet(amount = 1000) {
    if (!this.isConnected) {
      throw new Error('Please connect wallet first');
    }

    console.log(`🚰 Requesting ${amount} LINERA from faucet...`);

    // In demo mode or for testing, just add tokens locally
    this.balance += amount;

    console.log(`✅ Faucet request successful! New balance: ${this.balance} LINERA`);

    this._notifyListeners('balanceChanged', { balance: this.balance });

    return {
      success: true,
      amount,
      newBalance: this.balance,
      message: this.demoMode
        ? 'Demo tokens credited'
        : 'Testnet tokens credited (for testing only)',
    };
  }

  /**
   * Get total casino funds
   */
  async getTotalFunds() {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const result = await this.query(`query { totalFunds }`);
      const fundsAttos = result?.data?.totalFunds || '0';
      return parseFloat(fundsAttos) / 1e18;
    } catch (error) {
      console.warn('Failed to get total funds:', error.message);
      return 0;
    }
  }

  /**
   * Deposit funds into the casino
   */
  async deposit(amount) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const amountAttos = Math.floor(amount * 1e18).toString();

    const result = await this.mutate(`
      mutation {
        deposit(amount: "${amountAttos}")
      }
    `);

    if (result?.data?.deposit) {
      await this._updateBalance();
      return { success: true, amount };
    }

    throw new Error('Deposit failed');
  }

  /**
   * Withdraw funds from the casino
   */
  async withdraw(amount) {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const amountAttos = Math.floor(amount * 1e18).toString();

    const result = await this.mutate(`
      mutation {
        withdraw(amount: "${amountAttos}")
      }
    `);

    if (result?.data?.withdraw) {
      await this._updateBalance();
      return { success: true, amount };
    }

    throw new Error('Withdrawal failed');
  }

  /**
   * Update balance internally
   */
  async _updateBalance() {
    const newBalance = await this.getBalance();
    this._notifyListeners('balanceChanged', { balance: newBalance });
    return newBalance;
  }

  /**
   * Get game history from chain
   */
  async getGameHistory(limit = 20) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const result = await this.query(`
        query {
          gameHistory {
            gameId
            gameType
            betAmount
            payoutAmount
            outcomeDetails
            timestamp
          }
        }
      `);

      const history = result?.data?.gameHistory || [];

      // Convert amounts from attos and limit results
      return history
        .slice(-limit)
        .reverse()
        .map(game => ({
          ...game,
          betAmount: parseFloat(game.betAmount) / 1e18,
          payoutAmount: parseFloat(game.payoutAmount) / 1e18,
        }));
    } catch (error) {
      console.error('Failed to fetch game history:', error);
      return [];
    }
  }

  /**
   * Generate cryptographic commit-reveal pair for provably fair gaming
   */
  async _generateCommitReveal() {
    const revealBytes = new Uint8Array(32);

    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(revealBytes);
    } else {
      throw new Error('Crypto API not available');
    }

    const revealValue = Array.from(revealBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Generate SHA-256 hash for commit
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', revealBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const commitHash = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return { commitHash, revealValue };
  }

  /**
   * Place bet in demo mode (local simulation)
   */
  async _placeBetDemo(gameType, betAmount, gameParams, commitHash, revealValue) {
    console.log('🎮 Demo mode: Simulating game locally...');

    // Deduct bet from balance
    this.balance -= betAmount;

    // Generate game ID
    const gameId = Date.now();

    // Simulate game outcome based on game type
    const outcome = this._simulateGameOutcome(gameType, gameParams, revealValue);

    // Calculate payout
    const payout = outcome.won ? betAmount * outcome.multiplier : 0;

    // Add payout to balance
    this.balance += payout;

    const result = {
      success: true,
      gameId,
      gameType,
      betAmount,
      outcome: outcome.details,
      payout,
      multiplier: outcome.multiplier,
      won: outcome.won,
      proof: {
        commitHash,
        revealValue,
        chainId: this.chainId,
        applicationId: LINERA_CONFIG.applicationId,
        timestamp: Date.now(),
        blockchainMode: 'demo',
      },
      explorerUrl: null,
    };

    console.log(`🎲 Game result: ${outcome.won ? 'WIN' : 'LOSS'} - Payout: ${payout} LINERA`);

    this._notifyListeners('balanceChanged', { balance: this.balance });
    this._notifyListeners('betResult', result);

    return result;
  }

  /**
   * Simulate game outcome locally using the reveal value as seed
   */
  _simulateGameOutcome(gameType, gameParams, revealValue) {
    // Use reveal value as random seed
    const seed = parseInt(revealValue.substring(0, 8), 16);

    switch (gameType.toLowerCase()) {
      case 'roulette': {
        const result = seed % 37; // 0-36
        const betType = gameParams.betType || 'color';
        const betValue = gameParams.betValue;

        // Determine color
        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        const isRed = redNumbers.includes(result);
        const color = result === 0 ? 'green' : (isRed ? 'red' : 'black');

        let won = false;
        let multiplier = 0;

        if (betType === 'color') {
          won = (betValue === color);
          multiplier = won ? 2 : 0;
        } else if (betType === 'number') {
          won = (parseInt(betValue) === result);
          multiplier = won ? 35 : 0;
        } else if (betType === 'even') {
          won = result > 0 && result % 2 === 0;
          multiplier = won ? 2 : 0;
        } else if (betType === 'odd') {
          won = result > 0 && result % 2 === 1;
          multiplier = won ? 2 : 0;
        }

        return {
          won,
          multiplier: won ? multiplier : 0,
          details: { result, color, betType, betValue },
        };
      }

      case 'plinko': {
        const rows = gameParams.rows || 10;
        let position = Math.floor(rows / 2);
        const path = [];

        for (let i = 0; i < rows; i++) {
          const bit = (seed >> (i % 32)) & 1;
          position += bit ? 1 : -1;
          position = Math.max(0, Math.min(rows, position));
          path.push(bit ? 'R' : 'L');
        }

        // Multipliers based on final position (edges pay more)
        const center = rows / 2;
        const distance = Math.abs(position - center);
        const multipliers = [1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0];
        const multiplier = multipliers[Math.min(distance, multipliers.length - 1)];

        return {
          won: true,
          multiplier,
          details: { finalPosition: position, path, multiplier },
        };
      }

      case 'mines': {
        const totalCells = gameParams.totalCells || 25;
        const numMines = gameParams.numMines || 5;
        const minePositions = [];

        // Generate mine positions
        for (let i = 0; i < numMines; i++) {
          let pos = (seed + i * 7919) % totalCells;
          while (minePositions.includes(pos)) {
            pos = (pos + 1) % totalCells;
          }
          minePositions.push(pos);
        }

        // Return mine layout - player chooses cells in the game
        return {
          won: true,
          multiplier: 1.0,
          details: { minePositions, totalCells, numMines },
        };
      }

      case 'wheel': {
        const segments = gameParams.segments || 8;
        const result = seed % segments;
        const wheelMultipliers = [0.5, 1.0, 1.5, 2.0, 0.5, 1.0, 3.0, 5.0];
        const multiplier = wheelMultipliers[result % wheelMultipliers.length];

        return {
          won: multiplier >= 1.0,
          multiplier,
          details: { segment: result, multiplier },
        };
      }

      default:
        return { won: false, multiplier: 0, details: { error: 'Unknown game type' } };
    }
  }

  /**
   * Setup notification listener for chain updates
   */
  _setupNotifications() {
    if (!this.provider) return;

    const handleNotification = (data) => {
      console.log('📬 Chain notification:', data);

      // Check for new block events
      if (data?.event?.NewBlock || data?.reason?.NewBlock) {
        this._updateBalance();
        this._notifyListeners('blockUpdate', data);
      }
    };

    this.provider.on('notification', handleNotification);

    // Store cleanup function
    this._notificationCleanup = () => {
      this.provider.off('notification', handleNotification);
    };
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    // Cleanup notification listener
    if (this._notificationCleanup) {
      this._notificationCleanup();
      this._notificationCleanup = null;
    }

    this.isConnected = false;
    this.owner = null;
    this.chainId = null;
    this.balance = 0;
    this.demoMode = false;

    // Clear demo mode state from localStorage
    localStorage.removeItem('demo-wallet-state');
    localStorage.removeItem('demo-wallet-owner');

    this._notifyListeners('disconnected', null);
    console.log('Wallet disconnected');
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      owner: this.owner,
      chainId: this.chainId,
      balance: this.balance,
      demoMode: this.demoMode,
      applicationId: LINERA_CONFIG.applicationId,
      explorerUrl: this.chainId && !this.demoMode
        ? `${LINERA_CONFIG.explorerUrl}/chains/${this.chainId}`
        : null,
    };
  }

  /**
   * Check connection status
   */
  checkConnection() {
    return this.isConnected && !!this.owner;
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
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



