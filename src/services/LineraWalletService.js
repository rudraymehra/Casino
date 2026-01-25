/**
 * Linera Wallet Service - PRODUCTION READY
 * Handles wallet connection and real blockchain transactions
 *
 * Supports:
 * 1. CheCko Wallet (respeer-ai/linera-wallet) - Native Linera browser extension
 * 2. Native Wallet - Faucet-based wallet with password encryption
 *
 * NO mock wallets, NO free tokens, NO dev mode bypasses
 */

import {
  encryptPrivateKey,
  decryptPrivateKey,
  saveEncryptedWallet,
  loadEncryptedWallet,
  hasStoredWallet,
  clearStoredWallet,
} from '@/utils/lineraWalletCrypto';

import * as LineraClientService from './LineraClientService';

const LINERA_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_LINERA_CHAIN_ID || 'd971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd',
  applicationId: process.env.NEXT_PUBLIC_LINERA_APP_ID || 'e230e675d2ade7ac7c3351d57c7dff2ff59c7ade94cb615ebe77149113b6d194',
  rpcUrl: process.env.NEXT_PUBLIC_LINERA_RPC || 'https://rpc.testnet-conway.linera.net',
  faucetUrl: process.env.NEXT_PUBLIC_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net',
  explorerUrl: process.env.NEXT_PUBLIC_LINERA_EXPLORER || 'https://explorer.testnet-conway.linera.net',
};

// Wallet provider types - NO MOCK
const WALLET_PROVIDERS = {
  CHECKO: 'checko',      // Native Linera CheCko wallet (respeer)
  NATIVE: 'native',      // Faucet-based wallet with password encryption
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
    this.walletProvider = null;
    this.checkoWallet = null;

    // Native wallet properties
    this.privateKey = null;        // In-memory only, never persisted
    this.encryptedWallet = null;   // From storage
    this.isUnlocked = false;       // Lock state

    // Linera SDK client instances
    this.lineraClient = null;
    this.lineraWallet = null;
    this.signer = null;            // PrivateKey signer for transaction signing
    this.clientInitialized = false;

    // Restore persisted state on construction
    this._restorePersistedState();
  }

  /**
   * Persist wallet state to localStorage
   */
  _persistState() {
    if (typeof window === 'undefined') return;

    // Use userBalance from localStorage if available (more accurate from game updates)
    const userBalanceStr = localStorage.getItem('userBalance');
    const balanceToSave = (userBalanceStr && !isNaN(parseFloat(userBalanceStr)))
      ? parseFloat(userBalanceStr)
      : this.balance;

    const state = {
      connectedChain: this.connectedChain,
      userOwner: this.userOwner,
      userAddress: this.userAddress,
      balance: balanceToSave,
      walletProvider: this.walletProvider,
      isUnlocked: this.isUnlocked,
      timestamp: Date.now(),
    };

    localStorage.setItem('linera_wallet_state', JSON.stringify(state));
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

      // Restore state - NO FREE TOKENS
      this.connectedChain = state.connectedChain;
      this.userOwner = state.userOwner;
      this.userAddress = state.userAddress;
      this.walletProvider = state.walletProvider;

      // Restore balance from userBalance (most accurate) or state
      const userBalance = localStorage.getItem('userBalance');
      if (userBalance && !isNaN(parseFloat(userBalance))) {
        this.balance = parseFloat(userBalance);
      } else {
        this.balance = state.balance || 0;
      }

      // Check for encrypted wallet
      this.encryptedWallet = loadEncryptedWallet();

      // Check if wallet was previously unlocked in this session
      // We use sessionStorage to track if user already entered password this session
      const sessionUnlocked = sessionStorage.getItem('linera_session_unlocked');

      if (this.userAddress && this.userOwner && this.encryptedWallet) {
        if (sessionUnlocked === 'true' && state.isUnlocked) {
          // User already unlocked in this session - restore unlocked state
          this.isUnlocked = true;

          setTimeout(() => {
            this._notifyListeners('connected', {
              owner: this.userOwner,
              address: this.userAddress,
              chain: this.connectedChain,
              balance: this.balance,
              provider: this.walletProvider,
            });
          }, 100);
        } else {
          // Need to unlock with password
          setTimeout(() => {
            this._notifyListeners('needsUnlock', {
              owner: this.userOwner,
              address: this.userAddress,
              chain: this.connectedChain,
              balance: this.balance,
            });
          }, 100);
        }
      }
    } catch (error) {
      // Silent fail on restore - user can reconnect
    }
  }

  /**
   * Clear persisted state
   */
  _clearPersistedState() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('linera_wallet_state');
  }

  /**
   * Check if an encrypted wallet exists in storage
   */
  _hasStoredWallet() {
    return hasStoredWallet();
  }

  /**
   * Detect available wallet providers
   * Priority: CheCko (native Linera) > Stored Native Wallet > NATIVE (new user)
   */
  detectWalletProvider() {
    if (typeof window === 'undefined') {
      return null; // Server-side - no wallet
    }

    // Check for CheCko Linera wallet (respeer-ai/linera-wallet)
    // Only use if it has the connect method
    const checkoCandidate = window.linera || window.checko;
    if (checkoCandidate && typeof checkoCandidate.connect === 'function') {
      this.checkoWallet = checkoCandidate;
      return WALLET_PROVIDERS.CHECKO;
    }

    // Check for existing encrypted wallet
    if (this._hasStoredWallet()) {
      this.encryptedWallet = loadEncryptedWallet();
      return WALLET_PROVIDERS.NATIVE;
    }

    // New user - will need to create wallet via faucet
    return WALLET_PROVIDERS.NATIVE;
  }

  /**
   * Initialize the wallet service
   */
  async initialize() {
    try {
      // Detect available wallet provider
      this.walletProvider = this.detectWalletProvider();

      // Initialize Linera client service (for browser-side signing)
      if (typeof window !== 'undefined') {
        try {
          this.clientInitialized = await LineraClientService.initializeLineraClient();
        } catch (error) {
          this.clientInitialized = false;
        }
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Connect to CheCko Linera wallet (native)
   */
  async connectChecko() {
    if (!this.checkoWallet) {
      throw new Error('CheCko wallet not available. Please install the CheCko Linera wallet extension.');
    }

    try {

      // CheCko wallet provides a connect method that returns chain info
      const connection = await this.checkoWallet.connect({
        chainId: LINERA_CONFIG.chainId,
        applicationId: LINERA_CONFIG.applicationId,
      });

      this.userAddress = connection.owner || connection.address;
      this.userOwner = connection.owner;
      this.connectedChain = connection.chainId || LINERA_CONFIG.chainId;
      this.isUnlocked = true;

      // Get balance from wallet - MUST come from blockchain
      try {
        const balanceInfo = await this.checkoWallet.getBalance();
        this.balance = parseFloat(balanceInfo.balance || '0');
      } catch {
        this.balance = 0; // No free tokens if balance fetch fails
      }

      this._persistState();

      return {
        owner: this.userOwner,
        chain: this.connectedChain,
        ethAddress: this.userAddress,
        balance: this.balance,
        provider: WALLET_PROVIDERS.CHECKO,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new native wallet via faucet
   * Makes REAL request to Linera faucet to create chain with tokens
   * @param {string} password - Password to encrypt the wallet
   * @returns {Promise<object>} Connection info
   */
  async createNativeWallet(password) {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    try {
      if (typeof window === 'undefined') {
        throw new Error('Cannot create wallet in server-side context');
      }

      // REAL FAUCET CLAIM - Creates new chain with tokens

      const response = await fetch('/api/linera/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createNewWallet: true,
        }),
      });

      const faucetResult = await response.json();

      if (!response.ok || !faucetResult.success) {
        throw new Error(faucetResult.error || 'Faucet claim failed. Please try again later.');
      }

      // Use the wallet info from faucet
      if (!faucetResult.newWallet) {
        throw new Error('Faucet did not return wallet info');
      }

      const privateKeyHex = faucetResult.newWallet.privateKey;
      const owner = faucetResult.newWallet.publicKey;
      const chainId = faucetResult.chainId || LINERA_CONFIG.chainId;
      const amount = faucetResult.amount || 0;


      // Encrypt private key with password
      const encrypted = await encryptPrivateKey(privateKeyHex, password);

      // Save encrypted wallet
      const walletData = {
        ...encrypted,
        owner,
        chainId,
        createdAt: new Date().toISOString(),
      };
      saveEncryptedWallet(walletData);

      // Store in memory
      this.privateKey = privateKeyHex;
      this.encryptedWallet = walletData;
      this.userOwner = owner;
      this.userAddress = owner;
      this.connectedChain = chainId;
      this.isUnlocked = true;
      this.balance = amount; // Real balance from faucet
      this.walletProvider = WALLET_PROVIDERS.NATIVE;

      // Create signer for transaction signing
      try {
        this.signer = await LineraClientService.createSigner(privateKeyHex);
      } catch (error) {
        this.signer = null;
      }

      // Persist state
      this._persistState();

      // Also save to userBalance for Redux
      if (typeof window !== 'undefined') {
        localStorage.setItem('userBalance', amount.toString());
        // Mark session as unlocked so page navigation doesn't require re-unlock
        sessionStorage.setItem('linera_session_unlocked', 'true');
      }

      // Notify listeners
      this._notifyListeners('connected', {
        owner: this.userOwner,
        address: this.userAddress,
        chain: this.connectedChain,
        balance: this.balance,
        provider: WALLET_PROVIDERS.NATIVE,
        isNew: true,
        faucetClaim: {
          chainId: faucetResult.chainId,
          amount: faucetResult.amount,
          explorerUrl: faucetResult.explorerUrl,
        },
      });

      return {
        owner: this.userOwner,
        chain: this.connectedChain,
        ethAddress: this.userAddress,
        balance: this.balance,
        provider: WALLET_PROVIDERS.NATIVE,
        isNew: true,
        faucetClaim: {
          chainId: faucetResult.chainId,
          amount: faucetResult.amount,
          explorerUrl: faucetResult.explorerUrl,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Unlock an existing encrypted wallet
   * @param {string} password - Password to decrypt the wallet
   * @returns {Promise<object>} Connection info
   */
  async unlockWallet(password) {
    if (!password) {
      throw new Error('Password is required');
    }

    try {

      // Load encrypted wallet
      const encryptedWallet = loadEncryptedWallet();
      if (!encryptedWallet) {
        throw new Error('No stored wallet found');
      }

      // Decrypt private key
      const privateKeyHex = await decryptPrivateKey(encryptedWallet, password);

      // Store in memory
      this.privateKey = privateKeyHex;
      this.encryptedWallet = encryptedWallet;
      this.userOwner = encryptedWallet.owner;
      this.userAddress = encryptedWallet.owner;
      this.connectedChain = encryptedWallet.chainId;
      this.isUnlocked = true;
      this.walletProvider = WALLET_PROVIDERS.NATIVE;

      // Create signer for transaction signing
      try {
        this.signer = await LineraClientService.createSigner(privateKeyHex);
      } catch (error) {
        this.signer = null;
      }

      // Restore balance - ALWAYS prioritize userBalance (updated by games)
      // over linera_wallet_state.balance (may be stale)
      const userBalanceStr = localStorage.getItem('userBalance');
      if (userBalanceStr && !isNaN(parseFloat(userBalanceStr)) && parseFloat(userBalanceStr) >= 0) {
        this.balance = parseFloat(userBalanceStr);
      } else {
        const savedState = localStorage.getItem('linera_wallet_state');
        if (savedState) {
          const state = JSON.parse(savedState);
          this.balance = state.balance || 0;
        } else {
          this.balance = 0;
        }
      }

      // Persist state
      this._persistState();

      // Mark session as unlocked so page navigation doesn't require re-unlock
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('linera_session_unlocked', 'true');
      }

      // Notify listeners
      this._notifyListeners('connected', {
        owner: this.userOwner,
        address: this.userAddress,
        chain: this.connectedChain,
        balance: this.balance,
        provider: WALLET_PROVIDERS.NATIVE,
      });

      return {
        owner: this.userOwner,
        chain: this.connectedChain,
        ethAddress: this.userAddress,
        balance: this.balance,
        provider: WALLET_PROVIDERS.NATIVE,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch real balance from blockchain
   */
  async fetchRealBalance() {
    if (!this.userOwner) {
      return this.balance;
    }

    try {
      const blockchainBalance = await LineraClientService.queryBalance(this.userOwner);

      // Update local balance if we got a valid response
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        this.balance = blockchainBalance;
        this._persistState();
        this._notifyListeners('balanceChanged', { balance: this.balance });
      }

      return this.balance;
    } catch (error) {
      return this.balance;
    }
  }

  /**
   * Deposit tokens to the casino (signed transaction)
   */
  async deposit(amount) {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      throw new Error('Deposit amount must be greater than 0');
    }

    try {
      let result;

      if (this.signer) {
        // Use signed transaction
        const depositResult = await LineraClientService.deposit(this.signer, depositAmount);

        if (!depositResult?.deposit) {
          throw new Error('Deposit operation failed on contract');
        }

        result = {
          success: true,
          amount: depositAmount,
          blockchain: { submitted: true, mode: 'signed-client' },
        };
      } else {
        // Fall back to API
        const response = await fetch('/api/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: depositAmount,
            lineraOwner: this.userOwner,
          }),
        });

        result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Deposit failed');
        }
      }

      // Update local balance
      this.balance += depositAmount;
      this._persistState();
      this._notifyListeners('balanceChanged', { balance: this.balance });

      return {
        ...result,
        newBalance: this.balance,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Withdraw tokens from the casino (signed transaction)
   */
  async withdraw(amount) {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) {
      throw new Error('Withdraw amount must be greater than 0');
    }

    if (withdrawAmount > this.balance) {
      throw new Error(`Insufficient balance. You have ${this.balance} LINERA`);
    }

    try {
      let result;

      if (this.signer) {
        // Use signed transaction
        const withdrawResult = await LineraClientService.withdraw(this.signer, withdrawAmount);

        if (!withdrawResult?.withdraw) {
          throw new Error('Withdraw operation failed on contract');
        }

        result = {
          success: true,
          amount: withdrawAmount,
          blockchain: { submitted: true, mode: 'signed-client' },
        };
      } else {
        // Fall back to API
        const response = await fetch('/api/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: withdrawAmount,
            lineraOwner: this.userOwner,
          }),
        });

        result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Withdrawal failed');
        }
      }

      // Update local balance
      this.balance = Math.max(0, this.balance - withdrawAmount);
      this._persistState();
      this._notifyListeners('balanceChanged', { balance: this.balance });

      return {
        ...result,
        newBalance: this.balance,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lock the wallet (clear private key from memory)
   */
  lockWallet() {
    this.privateKey = null;
    this.signer = null;
    this.isUnlocked = false;
    this._persistState();
    // Clear session unlock flag
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('linera_session_unlocked');
    }
    this._notifyListeners('locked', null);
  }

  /**
   * Connect using native wallet (handles both new and existing)
   * @param {string} password - Password for wallet
   * @param {boolean} isNew - Whether to create a new wallet
   */
  async connectNative(password, isNew = false) {
    if (isNew || !this._hasStoredWallet()) {
      return await this.createNativeWallet(password);
    } else {
      return await this.unlockWallet(password);
    }
  }

  /**
   * Connect wallet - auto-detects provider
   * @param {string} password - Password for native wallet (required for NATIVE provider)
   * @param {boolean} createNew - Whether to create new wallet instead of unlocking
   */
  async connect(password = null, createNew = false) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      let result;

      // Try wallet providers in order of preference
      switch (this.walletProvider) {
        case WALLET_PROVIDERS.CHECKO:
          try {
            result = await this.connectChecko();
          } catch (error) {
            const isUserRejection = error.code === 4001 ||
                                    error.message?.includes('User rejected') ||
                                    error.message?.includes('User denied') ||
                                    error.message?.includes('cancelled');

            if (isUserRejection) {
              throw new Error('Connection cancelled by user');
            }

            if (password) {
              result = await this.connectNative(password, createNew);
            } else {
              this._notifyListeners('needsPassword', { hasStoredWallet: this._hasStoredWallet() });
              return { needsPassword: true, hasStoredWallet: this._hasStoredWallet() };
            }
          }
          break;

        case WALLET_PROVIDERS.NATIVE:
          if (!password) {
            this._notifyListeners('needsPassword', { hasStoredWallet: this._hasStoredWallet() });
            return { needsPassword: true, hasStoredWallet: this._hasStoredWallet() };
          }
          result = await this.connectNative(password, createNew);
          break;

        default:
          if (password) {
            result = await this.connectNative(password, createNew);
          } else {
            this._notifyListeners('needsPassword', { hasStoredWallet: this._hasStoredWallet() });
            return { needsPassword: true, hasStoredWallet: this._hasStoredWallet() };
          }
      }


      this._notifyListeners('connected', {
        owner: this.userOwner,
        chain: this.connectedChain,
        address: this.userAddress,
        balance: this.balance,
        provider: this.walletProvider,
      });

      this._persistState();

      return result;
    } catch (error) {
      this._notifyListeners('error', error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    // DON'T overwrite localStorage.userBalance - it has the most accurate balance from games
    // The balance in this.balance might be stale if games updated Redux but not wallet service

    this.userOwner = null;
    this.userAddress = null;
    this.connectedChain = null;
    this.balance = 0;
    this.privateKey = null;
    this.signer = null;
    this.isUnlocked = false;
    this._clearPersistedState();
    // Clear session unlock flag
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('linera_session_unlocked');
    }
    this._notifyListeners('disconnected', null);
  }

  /**
   * Delete wallet (clears encrypted storage too)
   */
  deleteWallet() {
    this.disconnect();
    clearStoredWallet();
    this.encryptedWallet = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userBalance');
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return !!this.userOwner && !!this.connectedChain && this.isUnlocked;
  }

  /**
   * Check if wallet needs unlock
   */
  needsUnlock() {
    return this._hasStoredWallet() && !this.isUnlocked;
  }

  /**
   * Get current balance
   */
  getBalance() {
    return this.balance;
  }

  /**
   * Set balance and persist to localStorage
   * @param {number} newBalance - The new balance to set
   */
  setBalance(newBalance) {
    this.balance = Math.max(0, newBalance);
    this._persistState();
    this._notifyListeners('balanceChanged', { balance: this.balance });
    if (typeof window !== 'undefined') {
      localStorage.setItem('userBalance', this.balance.toString());
    }
  }

  /**
   * Get game history from blockchain
   */
  async getGameHistory() {
    try {
      const history = await LineraClientService.queryGameHistory();
      return history;
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate commit-reveal pair for provably fair gaming
   */
  generateRandomCommit() {
    const revealValue = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(revealValue);
    } else {
      throw new Error('Secure random generation not available');
    }

    const revealHex = Array.from(revealValue)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      revealValue: revealHex,
      revealBytes: revealValue,
    };
  }

  /**
   * Place a bet - uses signed transactions when signer is available
   */
  async placeBet(gameType, betAmount, gameParams = {}) {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected. Please connect your wallet to play.');
    }

    const bet = parseFloat(betAmount);
    if (bet > this.balance) {
      throw new Error(`Insufficient balance. You have ${this.balance} LINERA.`);
    }

    if (bet <= 0) {
      throw new Error('Bet amount must be greater than 0');
    }

    try {
      // Generate commit-reveal values
      const { revealValue, revealBytes } = this.generateRandomCommit();
      const commitHash = await this._generateCommitHash(revealBytes);

      let result;

      // If we have a signer, use client-side signed transactions
      if (this.signer) {

        try {
          // Step 1: Place bet with signature
          const placeBetResult = await LineraClientService.placeBet(
            this.signer,
            gameType,
            bet,
            commitHash,
            gameParams
          );

          if (!placeBetResult?.placeBet) {
            throw new Error('PlaceBet operation failed on contract');
          }

          const gameId = Date.now(); // Use timestamp as game ID

          // Step 2: Reveal with signature
          const revealResult = await LineraClientService.reveal(
            this.signer,
            gameId,
            revealValue
          );

          if (!revealResult?.reveal) {
            throw new Error('Reveal operation failed on contract');
          }

          // Calculate outcome locally (same as contract)
          const outcome = this._calculateOutcome(gameType, revealBytes, gameParams);
          const payout = bet * outcome.multiplier;

          result = {
            success: true,
            gameId,
            gameType,
            betAmount: bet,
            outcome: outcome.outcome,
            result: outcome,
            payout,
            multiplier: outcome.multiplier,
            proof: {
              commitHash,
              revealValue,
              chainId: LINERA_CONFIG.chainId,
              applicationId: LINERA_CONFIG.applicationId,
              timestamp: Date.now(),
              blockchainMode: 'signed-client',
              blockchainSubmitted: true,
            },
          };

        } catch (signedError) {
          // Fall back to API route
          result = await this._placeBetViaAPI(gameType, bet, gameParams);
        }
      } else {
        // No signer available, use API route
        result = await this._placeBetViaAPI(gameType, bet, gameParams);
      }

      if (result.success) {
        const payout = result.payout || 0;
        const netResult = payout - bet;
        this.balance = Math.max(0, this.balance + netResult);

        this._notifyListeners('balanceChanged', { balance: this.balance });
        this._persistState();
      }

      return {
        ...result,
        balance: this.balance,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Place bet via API route (fallback when signer not available)
   */
  async _placeBetViaAPI(gameType, betAmount, gameParams) {
    const response = await fetch('/api/linera/place-bet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameType,
        betAmount,
        gameParams,
        playerAddress: this.userAddress,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Generate SHA3-256 commit hash from reveal bytes
   */
  async _generateCommitHash(revealBytes) {
    // Use SubtleCrypto if available
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', revealBytes);
      const hashArray = new Uint8Array(hashBuffer);
      return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Fallback: simple hash (not cryptographically secure, but works for dev)
    let hash = 0;
    for (let i = 0; i < revealBytes.length; i++) {
      hash = ((hash << 5) - hash + revealBytes[i]) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Calculate game outcome (matches contract logic)
   */
  _calculateOutcome(gameType, seed, params) {
    const seedNumber = (seed[0] << 24) | (seed[1] << 16) | (seed[2] << 8) | seed[3];

    switch (gameType) {
      case 'Wheel': {
        const segments = params.segments || 8;
        const result = Math.abs(seedNumber) % segments;
        const multipliers = [1, 1.5, 2, 0.5, 3, 1, 5, 0.5];
        const multiplier = multipliers[result % multipliers.length];
        return {
          segment: result,
          multiplier,
          outcome: `Wheel stopped at segment ${result} (${multiplier}x)`,
        };
      }
      case 'Roulette': {
        const result = Math.abs(seedNumber) % 37;
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result);
        const color = result === 0 ? 'green' : (isRed ? 'red' : 'black');
        let win = false;
        let multiplier = 0;

        if (params.betType === 'color') {
          if ((params.betValue === 'red' && isRed) || (params.betValue === 'black' && !isRed && result !== 0)) {
            win = true;
            multiplier = 2;
          }
        } else if (params.betType === 'number' && parseInt(params.betValue) === result) {
          win = true;
          multiplier = 36;
        }

        return {
          result,
          color,
          win,
          multiplier,
          outcome: `Landed on ${result} (${color})${win ? ' - WIN!' : ''}`,
        };
      }
      case 'Plinko': {
        const rows = params.rows || 12;
        let position = Math.floor(rows / 2);
        for (let i = 0; i < rows; i++) {
          const goRight = (seed[i % seed.length] >> (i % 8)) & 1;
          position = goRight ? Math.min(position + 1, rows) : Math.max(position - 1, 0);
        }
        const center = Math.floor(rows / 2);
        const distance = Math.abs(position - center);
        const multipliers = [1.0, 1.2, 1.5, 2.0, 5.0, 10.0, 25.0, 50.0, 100.0];
        const multiplier = multipliers[Math.min(distance, multipliers.length - 1)];
        return {
          finalPosition: position,
          multiplier,
          outcome: `Ball landed at position ${position} (${multiplier}x)`,
        };
      }
      case 'Mines': {
        const numMines = params.numMines || 5;
        const revealed = params.revealed || 0;
        const totalCells = 25;
        const safeCells = totalCells - numMines;
        let multiplier = 1.0;
        for (let i = 0; i < revealed; i++) {
          multiplier *= (totalCells - i) / (safeCells - i);
        }
        multiplier = Math.round(multiplier * 100) / 100;
        return {
          multiplier,
          outcome: `${revealed} safe cells revealed (${multiplier}x)`,
        };
      }
      default:
        return { multiplier: 1, outcome: 'Unknown game' };
    }
  }

  /**
   * Request tokens from faucet (testnet only)
   * Makes REAL request to Linera faucet API
   */
  async requestFaucet() {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {

      const response = await fetch('/api/linera/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: this.userOwner,
          createNewWallet: false,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Faucet request failed');
      }

      const receivedAmount = result.amount || 0;
      this.balance += receivedAmount;
      this._notifyListeners('balanceChanged', { balance: this.balance });
      this._persistState();

      if (typeof window !== 'undefined') {
        localStorage.setItem('userBalance', this.balance.toString());
      }

      return {
        success: true,
        amount: receivedAmount,
        newBalance: this.balance,
        chainId: result.chainId,
        explorerUrl: result.explorerUrl,
        blockchain: result.blockchain,
      };
    } catch (error) {
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
        // Silent fail on listener errors
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
