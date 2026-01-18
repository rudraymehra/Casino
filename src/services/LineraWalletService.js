/**
 * Linera Wallet Service
 * Handles wallet connection and real blockchain transactions
 * 
 * Supports:
 * 1. CheCko Wallet (respeer-ai/linera-wallet) - Native Linera browser extension
 * 2. MetaMask Bridge - Uses MetaMask for address identification
 * 3. Dev Mode - Mock wallet for development
 * 
 * v1.1.0 - Fixed _notifyListeners method calls
 */

// MetaMask SDK import removed - Push Universal Wallet handles connections
// import { MetaMaskSDK } from '@metamask/sdk';

const LINERA_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || '47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || '387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584',
  rpcUrl: 'http://localhost:8080', // Local service proxies to testnet
  faucetUrl: 'https://faucet.testnet-conway.linera.net',
  explorerUrl: 'https://explorer.testnet-conway.linera.net',
};

// Wallet provider types
const WALLET_PROVIDERS = {
  CHECKO: 'checko',      // Native Linera CheCko wallet (respeer)
  METAMASK: 'metamask',  // MetaMask bridge mode
  MOCK: 'mock',          // Development mock wallet
};

const GAME_TYPES = {
  ROULETTE: 'Roulette',
  PLINKO: 'Plinko',
  MINES: 'Mines',
  WHEEL: 'Wheel',
};

// Initialize MetaMask SDK for mobile connections
let metamaskSDK = null;

class LineraWalletService {
  constructor() {
    this.connectedChain = null;
    this.userOwner = null;
    this.userAddress = null;
    this.isInitialized = false;
    this.listeners = new Set();
    this.balance = 0;
    this.walletProvider = null;
    this.checkoWallet = null;
    this.metamaskProvider = null;
    
    // Restore persisted state on construction
    this._restorePersistedState();
  }
  
  /**
   * Persist wallet state to localStorage
   */
  _persistState() {
    if (typeof window === 'undefined') return;
    
    const state = {
      connectedChain: this.connectedChain,
      userOwner: this.userOwner,
      userAddress: this.userAddress,
      balance: this.balance,
      walletProvider: this.walletProvider,
      timestamp: Date.now(),
    };
    
    localStorage.setItem('linera_wallet_state', JSON.stringify(state));
    console.log('💾 Linera wallet state persisted');
  }
  
  /**
   * Restore wallet state from localStorage
   */
  _restorePersistedState() {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('linera_wallet_state');
      if (!saved) return;
      
      const state = JSON.parse(saved);
      
      // Check if state is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - state.timestamp > maxAge) {
        localStorage.removeItem('linera_wallet_state');
        return;
      }
      
      // Restore state
      this.connectedChain = state.connectedChain;
      this.userOwner = state.userOwner;
      this.userAddress = state.userAddress;
      this.balance = state.balance || 0;
      this.walletProvider = state.walletProvider;
      
      console.log('🔄 Linera wallet state restored:', {
        address: this.userAddress,
        balance: this.balance,
      });
      
      // Notify listeners of restored connection
      if (this.userAddress && this.userOwner) {
        setTimeout(() => {
          this._notifyListeners('connected', {
            owner: this.userOwner,
            address: this.userAddress,
            chain: this.connectedChain,
            balance: this.balance,
          });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to restore Linera wallet state:', error);
    }
  }
  
  /**
   * Clear persisted state
   */
  _clearPersistedState() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('linera_wallet_state');
    console.log('🗑️ Linera wallet state cleared');
  }

  /**
   * Detect available wallet providers
   * Priority: CheCko (native Linera) > MetaMask > Mock
   */
  detectWalletProvider() {
    if (typeof window === 'undefined') {
      return WALLET_PROVIDERS.MOCK;
    }

    // Check for CheCko Linera wallet (respeer-ai/linera-wallet)
    // The wallet injects window.linera or window.checko when installed
    if (window.linera || window.checko) {
      console.log('🔗 CheCko Linera wallet detected');
      this.checkoWallet = window.linera || window.checko;
      return WALLET_PROVIDERS.CHECKO;
    }

    // Check for MetaMask
    if (window.ethereum) {
      console.log('🦊 MetaMask detected (bridge mode)');
      return WALLET_PROVIDERS.METAMASK;
    }

    // Fallback to mock in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🎮 Development mode - using mock wallet');
      return WALLET_PROVIDERS.MOCK;
    }

    return null;
  }

  /**
   * Initialize the wallet service
   * NOTE: MetaMask SDK initialization is DISABLED because Push Universal Wallet
   * handles wallet connections (including MetaMask) internally.
   * Having two MetaMask SDKs causes connection conflicts.
   */
  async initialize() {
    try {
      console.log('🎰 Initializing Linera Wallet Service...');
      console.log(`   Chain ID: ${LINERA_CONFIG.chainId}`);
      console.log(`   App ID: ${LINERA_CONFIG.applicationId}`);
      
      // DISABLED: MetaMask SDK initialization
      // Push Universal Wallet handles MetaMask/WalletConnect connections
      // Initializing a separate MetaMask SDK causes conflicts with QR code scanning
      /*
      if (typeof window !== 'undefined' && !metamaskSDK) {
        try {
          metamaskSDK = new MetaMaskSDK({...});
          await metamaskSDK.init();
        } catch (sdkError) {
          console.warn('MetaMask SDK init failed');
        }
      }
      */
      
      // Use window.ethereum directly if available (for legacy support)
      if (typeof window !== 'undefined' && window.ethereum) {
        this.metamaskProvider = window.ethereum;
        console.log('📱 Using window.ethereum for MetaMask (Push wallet handles connections)');
      }
      
      // Detect available wallet provider
      this.walletProvider = this.detectWalletProvider();
      console.log(`   Wallet Provider: ${this.walletProvider || 'none'}`);
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[LineraWalletService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Connect to CheCko Linera wallet (native)
   */
  async connectChecko() {
    if (!this.checkoWallet) {
      throw new Error('CheCko wallet not available');
    }

    try {
      console.log('🔗 Connecting to CheCko Linera wallet...');
      
      // CheCko wallet provides a connect method that returns chain info
      const connection = await this.checkoWallet.connect({
        chainId: LINERA_CONFIG.chainId,
        applicationId: LINERA_CONFIG.applicationId,
      });

      this.userAddress = connection.owner || connection.address;
      this.userOwner = connection.owner;
      this.connectedChain = connection.chainId || LINERA_CONFIG.chainId;
      
      // Get balance from wallet
      try {
        const balanceInfo = await this.checkoWallet.getBalance();
        this.balance = parseFloat(balanceInfo.balance || 1000);
      } catch {
        this.balance = 1000; // Fallback
      }

      console.log('✅ CheCko wallet connected:', this.userOwner);
      return {
        owner: this.userOwner,
        chain: this.connectedChain,
        ethAddress: this.userAddress,
        balance: this.balance,
        provider: WALLET_PROVIDERS.CHECKO,
      };
    } catch (error) {
      console.error('CheCko connection failed:', error);
      throw error;
    }
  }

  /**
   * Find the real MetaMask browser extension provider (bypassing SDK wrappers)
   */
  findRealMetaMaskProvider() {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }

    // Check if there are multiple providers (common when multiple wallets installed)
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      // Find MetaMask specifically - prefer the one with _metamask (browser extension)
      const extensionProvider = window.ethereum.providers.find(
        p => p.isMetaMask && p._metamask
      );
      if (extensionProvider) {
        console.log('🔍 Found MetaMask browser extension in providers array');
        return extensionProvider;
      }
      
      // Fallback to any MetaMask provider
      const anyMetaMask = window.ethereum.providers.find(p => p.isMetaMask);
      if (anyMetaMask) {
        console.log('🔍 Found MetaMask provider in providers array');
        return anyMetaMask;
      }
    }

    // Check if window.ethereum itself is MetaMask browser extension
    if (window.ethereum.isMetaMask && window.ethereum._metamask) {
      console.log('🔍 window.ethereum is MetaMask browser extension');
      return window.ethereum;
    }

    // Check if it's MetaMask (might be SDK wrapped)
    if (window.ethereum.isMetaMask) {
      console.log('🔍 window.ethereum is MetaMask (possibly SDK)');
      return window.ethereum;
    }

    return null;
  }

  /**
   * Connect via MetaMask (bridge mode)
   * Tries to use browser extension directly, falling back to SDK modal
   */
  async connectMetaMask() {
    if (typeof window === 'undefined') {
      throw new Error('MetaMask not available');
    }

    try {
      console.log('🦊 Connecting via MetaMask...');
      
      // Check if any ethereum provider exists
      if (!window.ethereum) {
        throw new Error('No wallet detected. Please install MetaMask browser extension.');
      }
      
      // Find the real MetaMask provider
      const provider = this.findRealMetaMaskProvider() || window.ethereum;
      
      console.log('📦 Provider info:', {
        isMetaMask: provider.isMetaMask,
        hasMetamaskInternal: !!provider._metamask,
        hasProviders: !!window.ethereum.providers,
      });

      console.log('🔓 Requesting wallet connection...');
      
      try {
        // Request account access - this should trigger the MetaMask popup
        const accounts = await provider.request({
          method: 'eth_requestAccounts',
        });

        if (accounts && accounts.length > 0) {
          const ethAddress = accounts[0];
          this.userAddress = ethAddress;
          this.userOwner = `User:${ethAddress.toLowerCase().replace('0x', '')}`;
          this.connectedChain = LINERA_CONFIG.chainId;
          this.balance = 1000; // Starting balance for demo

          console.log('✅ Wallet connected:', this.userOwner);
          
          // Notify listeners of connection
          this._notifyListeners('connected', {
            owner: this.userOwner,
            address: this.userAddress,
            chain: this.connectedChain,
            balance: this.balance,
          });
          
          return {
            owner: this.userOwner,
            chain: this.connectedChain,
            ethAddress,
            balance: this.balance,
            provider: WALLET_PROVIDERS.METAMASK,
          };
        } else {
          throw new Error('No accounts returned. Please unlock your wallet and try again.');
        }
      } catch (extError) {
        // Check for user rejection
        if (extError.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection in your wallet.');
        }
        // Check for pending request
        if (extError.code === -32002) {
          throw new Error('Connection request pending. Please check your wallet for a pending request.');
        }
        console.log('Wallet connection failed:', extError.message);
        throw extError;
      }
    } catch (error) {
      console.error('MetaMask connection failed:', {
        message: error.message,
        code: error.code,
        name: error.name,
      });
      throw error;
    }
  }

  /**
   * Connect mock wallet (dev mode)
   */
  connectMock() {
    console.log('🎮 Connecting mock wallet (dev mode)...');
    
    const mockAddress = '0xDEV1234567890abcdef1234567890abcdef1234';
    this.userAddress = mockAddress;
    this.userOwner = `User:${mockAddress.toLowerCase().replace('0x', '')}`;
    this.connectedChain = LINERA_CONFIG.chainId;
    this.balance = 1000;

    console.log('✅ Mock wallet connected:', this.userOwner);
    return {
      owner: this.userOwner,
      chain: this.connectedChain,
      ethAddress: mockAddress,
      balance: this.balance,
      provider: WALLET_PROVIDERS.MOCK,
    };
  }

  /**
   * Connect wallet - auto-detects provider
   * Priority: CheCko (native) > MetaMask (bridge) > Mock (dev)
   */
  async connect() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const isDev = process.env.NODE_ENV === 'development';
      let result;

      // Try wallet providers in order of preference
      switch (this.walletProvider) {
        case WALLET_PROVIDERS.CHECKO:
          try {
            result = await this.connectChecko();
          } catch (error) {
            // Check if user rejected the connection
            const isUserRejection = error.code === 4001 || 
                                    error.message?.includes('User rejected') ||
                                    error.message?.includes('User denied') ||
                                    error.message?.includes('cancelled');
            
            if (isUserRejection) {
              console.log('❌ User cancelled wallet connection');
              throw new Error('Connection cancelled by user');
            }
            
            console.warn('CheCko failed, falling back:', error.message);
            if (window.ethereum) {
              result = await this.connectMetaMask();
            } else {
              throw error;
            }
          }
          break;

        case WALLET_PROVIDERS.METAMASK:
          try {
            result = await this.connectMetaMask();
          } catch (error) {
            // Check if user rejected the connection (code 4001 = user rejected)
            // Also check for MetaMask SDK specific rejection messages
            const errorMessage = error.message?.toLowerCase() || '';
            const isUserRejection = error.code === 4001 || 
                                    error.code === -32002 || // Request pending
                                    errorMessage.includes('user rejected') ||
                                    errorMessage.includes('user denied') ||
                                    errorMessage.includes('rejected') ||
                                    errorMessage.includes('cancelled') ||
                                    errorMessage.includes('canceled') ||
                                    errorMessage.includes('closed') ||
                                    errorMessage.includes('timed out');
            
            if (isUserRejection) {
              console.log('❌ User cancelled wallet connection');
              throw new Error('Connection cancelled by user');
            }
            
            // Only fallback to mock for other errors in dev mode
            if (isDev && !isUserRejection) {
              console.warn('MetaMask failed (not user rejection), using mock:', error.message);
              result = this.connectMock();
            } else {
              throw error;
            }
          }
          break;

        case WALLET_PROVIDERS.MOCK:
          // In dev mode with no wallet, require explicit mock connection
          console.log('🎮 No wallet detected - using mock wallet for development');
          result = this.connectMock();
          break;

        default:
          // Don't auto-connect mock - require user action
          throw new Error('No wallet provider available. Please install MetaMask or a Linera-compatible wallet.');
      }

      console.log('[LineraWalletService] Connected:', {
        owner: this.userOwner,
        chain: this.connectedChain,
        balance: this.balance,
        provider: this.walletProvider,
      });

      this._notifyListeners('connected', {
        owner: this.userOwner,
        chain: this.connectedChain,
        address: this.userAddress,
        balance: this.balance,
        provider: this.walletProvider,
      });
      
      // Persist state for page navigation
      this._persistState();

      return result;
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
    this._clearPersistedState();
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

export { lineraWalletService, LineraWalletService, LINERA_CONFIG, GAME_TYPES, WALLET_PROVIDERS };
export default lineraWalletService;
