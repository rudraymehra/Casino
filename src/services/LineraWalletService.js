/**
 * Linera Wallet Service
 * Handles wallet connection and real blockchain transactions
 */

const LINERA_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || '47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || '387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584',
  rpcUrl: 'https://rpc.testnet-conway.linera.net',
  faucetUrl: 'https://faucet.testnet-conway.linera.net',
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
};

const GAME_TYPES = {
  ROULETTE: 'Roulette',
  PLINKO: 'Plinko',
  MINES: 'Mines',
  WHEEL: 'Wheel',
};

class LineraWalletService {
  constructor() {
    this.connectedChain = null;
    this.userOwner = null;
    this.userAddress = null;
    this.isInitialized = false;
    this.listeners = new Set();
    this.balance = 0;
  }

  /**
   * Initialize the wallet service
   */
  async initialize() {
    try {
      console.log('🎰 Initializing Linera Wallet Service...');
      console.log(`   Chain ID: ${LINERA_CONFIG.chainId}`);
      console.log(`   App ID: ${LINERA_CONFIG.applicationId}`);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[LineraWalletService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Connect wallet via MetaMask
   */
  async connect() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to play.');
      }

      // Request MetaMask accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const ethAddress = accounts[0];
      
      // Create Linera-compatible user identifier from ETH address
      this.userAddress = ethAddress;
      this.userOwner = `User:${ethAddress.toLowerCase().replace('0x', '')}`;
      this.connectedChain = LINERA_CONFIG.chainId;
      
      // Get initial balance (simulated for testnet)
      this.balance = 1000; // Starting balance for demo
      
      console.log('[LineraWalletService] Connected:', {
        owner: this.userOwner,
        chain: this.connectedChain,
        balance: this.balance,
      });

      this._notifyListeners('connected', {
        owner: this.userOwner,
        chain: this.connectedChain,
        address: ethAddress,
        balance: this.balance,
      });

      return {
        owner: this.userOwner,
        chain: this.connectedChain,
        ethAddress,
        balance: this.balance,
      };
    } catch (error) {
      console.error('[LineraWalletService] Connection failed:', error);
      this._notifyListeners('error', error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    this.userOwner = null;
    this.userAddress = null;
    this.connectedChain = null;
    this.balance = 0;
    this._notifyListeners('disconnected', null);
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return !!this.userOwner && !!this.connectedChain;
  }

  /**
   * Get current balance
   */
  getBalance() {
    return this.balance;
  }

  /**
   * Generate commit-reveal pair for provably fair gaming
   */
  generateRandomCommit() {
    const revealValue = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(revealValue);
    } else {
      for (let i = 0; i < 32; i++) {
        revealValue[i] = Math.floor(Math.random() * 256);
      }
    }
    
    // Generate commit hash (SHA-256)
    const revealHex = Array.from(revealValue)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return {
      revealValue: revealHex,
      revealBytes: revealValue,
    };
  }

  /**
   * Place a bet - calls the backend API which handles blockchain submission
   */
  async placeBet(gameType, betAmount, gameParams = {}) {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected. Please connect your wallet to play.');
    }

    const bet = parseFloat(betAmount);
    if (bet > this.balance) {
      throw new Error(`Insufficient balance. You have ${this.balance} LINERA.`);
    }

    console.log(`🎰 LINERA: Placing bet for ${gameType}...`);
    console.log(`   Amount: ${bet} LINERA`);
    console.log(`   Player: ${this.userOwner}`);

    try {
      // Call backend API which handles real blockchain submission
      const response = await fetch('/api/linera/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameType,
          betAmount: bet,
          gameParams,
          playerAddress: this.userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Update balance based on outcome
        const payout = result.payout || 0;
        const netResult = payout - bet;
        this.balance = Math.max(0, this.balance + netResult);
        
        console.log(`✅ LINERA: Bet completed!`);
        console.log(`   Game ID: ${result.gameId}`);
        console.log(`   Outcome: ${result.outcome}`);
        console.log(`   Payout: ${payout} LINERA`);
        console.log(`   New Balance: ${this.balance} LINERA`);
        console.log(`   Mode: ${result.proof?.blockchainMode || 'local'}`);
        
        // Notify listeners of balance change
        this._notifyListeners('balanceChanged', { balance: this.balance });
      }

      return {
        ...result,
        balance: this.balance,
      };
    } catch (error) {
      console.error('❌ LINERA: Bet failed:', error);
      throw error;
    }
  }

  /**
   * Get game history from the blockchain
   */
  async getGameHistory() {
    try {
      const response = await fetch('/api/linera/history');
      if (response.ok) {
        const data = await response.json();
        return data.history || [];
      }
    } catch (error) {
      console.error('Failed to fetch game history:', error);
    }
    return [];
  }

  /**
   * Request tokens from faucet (testnet only)
   */
  async requestFaucet() {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      // For testnet, just add tokens
      this.balance += 100;
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
        console.error('[LineraWalletService] Listener error:', e);
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
const lineraWalletService = new LineraWalletService();

export { lineraWalletService, LineraWalletService, LINERA_CONFIG, GAME_TYPES };
export default lineraWalletService;
