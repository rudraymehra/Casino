import { createSlice } from '@reduxjs/toolkit';

// Load initial state from localStorage
const loadInitialState = () => {
  if (typeof window !== 'undefined') {
    const savedBalance = localStorage.getItem('userBalance');
    const savedLoading = localStorage.getItem('isLoading');

    // Check for Linera wallet connection (dev mode or actual connection)
    const devWalletState = localStorage.getItem('dev-wallet-state');
    const lineraWalletState = localStorage.getItem('linera_wallet_state');
    const isDev = process.env.NODE_ENV === 'development';

    // In dev mode, always allow balance restoration
    // Otherwise check if Linera wallet was connected
    const walletConnected = isDev || devWalletState === 'connected' || !!lineraWalletState;

    let cleanBalance = "0";
    if (savedBalance && !isNaN(savedBalance) && parseFloat(savedBalance) >= 0) {
      cleanBalance = savedBalance;
    }

    // In dev mode with no balance, set demo balance
    if (isDev && (!cleanBalance || parseFloat(cleanBalance) <= 0)) {
      cleanBalance = "1000";
      localStorage.setItem('userBalance', cleanBalance);
      console.log('DEV MODE: Initialized demo balance to 1000 LINERA');
    }

    return {
      userBalance: cleanBalance,
      isLoading: savedLoading === 'true' || false,
    };
  }
  return {
    userBalance: "0",
    isLoading: false,
  };
};

const initialState = loadInitialState();

const balanceSlice = createSlice({
  name: 'balance',
  initialState,
  reducers: {
    setBalance(state, action) {
      const newBalance = action.payload;
      // Ensure balance never goes negative
      if (parseFloat(newBalance) < 0) {
        state.userBalance = "0";
        console.warn('Attempted to set negative balance, setting to 0 instead');
      } else {
        state.userBalance = newBalance;
      }
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('userBalance', state.userBalance);
      }
    },
    addToBalance(state, action) {
      const amountToAdd = parseFloat(action.payload);
      const currentBalance = parseFloat(state.userBalance);
      const newBalance = Math.max(0, currentBalance + amountToAdd).toFixed(5);
      state.userBalance = newBalance;
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('userBalance', newBalance);
      }
    },
    subtractFromBalance(state, action) {
      const amountToSubtract = parseFloat(action.payload);
      const currentBalance = parseFloat(state.userBalance);
      const newBalance = Math.max(0, currentBalance - amountToSubtract).toFixed(5);
      state.userBalance = newBalance;
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('userBalance', newBalance);
      }
    },
    setLoading(state, action) {
      state.isLoading = action.payload;
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('isLoading', action.payload.toString());
      }
    },
  },
});

export const { setBalance, addToBalance, subtractFromBalance, setLoading } = balanceSlice.actions;

// Utility functions for localStorage operations
export const loadBalanceFromStorage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('userBalance') || "0";
  }
  return "0";
};

export const saveBalanceToStorage = (balance) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userBalance', balance);
  }
};

export default balanceSlice.reducer;
