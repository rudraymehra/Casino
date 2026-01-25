import { createSlice } from '@reduxjs/toolkit';

/**
 * Balance Slice - PRODUCTION READY
 * Balance is ONLY set from actual blockchain operations (faucet claims, game results)
 * NO free tokens, NO dev mode bypasses
 */

// Load initial state from localStorage
const loadInitialState = () => {
  if (typeof window !== 'undefined') {
    const savedBalance = localStorage.getItem('userBalance');
    const lineraWalletState = localStorage.getItem('linera_wallet_state');

    // Only restore balance if there's a valid wallet state
    let cleanBalance = "0";
    if (lineraWalletState && savedBalance && !isNaN(savedBalance) && parseFloat(savedBalance) >= 0) {
      cleanBalance = savedBalance;
    }

    // NO FREE TOKENS - balance must come from blockchain (faucet or games)

    return {
      userBalance: cleanBalance,
      isLoading: false,
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
    },
    // Reset balance to 0 (for logout/disconnect)
    resetBalance(state) {
      state.userBalance = "0";
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userBalance');
      }
    },
  },
});

export const { setBalance, addToBalance, subtractFromBalance, setLoading, resetBalance } = balanceSlice.actions;

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
