/**
 * Wallet Storage Utilities
 * Handles wallet persistence across different environments (local, Vercel, etc.)
 */

// Storage keys
const STORAGE_KEYS = {
  CONNECTED: 'wagmi.connected',
  ADDRESS: 'wagmi.address',
  CONNECTOR: 'wagmi.connector',
  LAST_RECONNECT: 'lastReconnectAttempt'
};

// Safe storage access with multiple fallbacks
const safeStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    try {
      // Try multiple storage methods
      let value = null;
      
      // 1. Try localStorage
      try {
        value = localStorage.getItem(key);
        if (value !== null) {
          
          return value;
        }
      } catch (e) {
        console.warn(`localStorage failed for ${key}:`, e);
      }
      
      // 2. Try sessionStorage
      try {
        value = sessionStorage.getItem(key);
        if (value !== null) {
          
          return value;
        }
      } catch (e) {
        console.warn(`sessionStorage failed for ${key}:`, e);
      }
      
      // 3. Try document.cookie as last resort
      try {
        const cookies = document.cookie.split(';');
        const cookie = cookies.find(c => c.trim().startsWith(`${key}=`));
        if (cookie) {
          value = cookie.split('=')[1];
          
          return value;
        }
      } catch (e) {
        console.warn(`cookies failed for ${key}:`, e);
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get ${key} from storage:`, error);
      return null;
    }
  },
  
  setItem: (key, value) => {
    if (typeof window === 'undefined') return false;
    let success = false;
    
    try {
      // 1. Try localStorage
      try {
        localStorage.setItem(key, value);
        
        success = true;
      } catch (e) {
        console.warn(`localStorage failed for ${key}:`, e);
      }
      
      // 2. Try sessionStorage
      try {
        sessionStorage.setItem(key, value);
        
        success = true;
      } catch (e) {
        console.warn(`sessionStorage failed for ${key}:`, e);
      }
      
      // 3. Try document.cookie as fallback
      try {
        document.cookie = `${key}=${value}; path=/; max-age=86400`; // 24 hours
        
        success = true;
      } catch (e) {
        console.warn(`cookies failed for ${key}:`, e);
      }
      
      return success;
    } catch (error) {
      console.warn(`Failed to set ${key} in storage:`, error);
      return false;
    }
  },
  
  removeItem: (key) => {
    if (typeof window === 'undefined') return false;
    let success = false;
    
    try {
      // Remove from all storage methods
      try {
        localStorage.removeItem(key);
        
        success = true;
      } catch (e) {
        console.warn(`localStorage remove failed for ${key}:`, e);
      }
      
      try {
        sessionStorage.removeItem(key);
        
        success = true;
      } catch (e) {
        console.warn(`sessionStorage remove failed for ${key}:`, e);
      }
      
      try {
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        
        success = true;
      } catch (e) {
        console.warn(`cookies remove failed for ${key}:`, e);
      }
      
      return success;
    } catch (error) {
      console.warn(`Failed to remove ${key} from storage:`, error);
      return false;
    }
  }
};

export const walletStorage = {
  // Get wallet connection state
  getConnectionState: () => {
    const wasConnected = safeStorage.getItem(STORAGE_KEYS.CONNECTED);
    const address = safeStorage.getItem(STORAGE_KEYS.ADDRESS);
    const connector = safeStorage.getItem(STORAGE_KEYS.CONNECTOR);
    
    return {
      wasConnected: wasConnected === 'true',
      address,
      connector
    };
  },
  
  // Save wallet connection state
  saveConnectionState: (address, connector) => {
    const success = safeStorage.setItem(STORAGE_KEYS.CONNECTED, 'true') &&
                   safeStorage.setItem(STORAGE_KEYS.ADDRESS, address) &&
                   safeStorage.setItem(STORAGE_KEYS.CONNECTOR, connector);
    
    if (success) {
    } else {
      console.warn('Failed to save wallet state');
    }
    
    return success;
  },
  
  // Clear wallet connection state
  clearConnectionState: () => {
    const success = safeStorage.removeItem(STORAGE_KEYS.CONNECTED) &&
                   safeStorage.removeItem(STORAGE_KEYS.ADDRESS) &&
                   safeStorage.removeItem(STORAGE_KEYS.CONNECTOR) &&
                   safeStorage.removeItem(STORAGE_KEYS.LAST_RECONNECT);
    
    if (success) {
    } else {
      console.warn('Failed to clear wallet state');
    }
    
    return success;
  },
  
  // Get last reconnect attempt time
  getLastReconnectAttempt: () => {
    const lastAttempt = safeStorage.getItem(STORAGE_KEYS.LAST_RECONNECT);
    return lastAttempt ? parseInt(lastAttempt) : 0;
  },
  
  // Set last reconnect attempt time
  setLastReconnectAttempt: (timestamp) => {
    return safeStorage.setItem(STORAGE_KEYS.LAST_RECONNECT, timestamp.toString());
  },
  
  // Clear last reconnect attempt time
  clearLastReconnectAttempt: () => {
    return safeStorage.removeItem(STORAGE_KEYS.LAST_RECONNECT);
  }
};

export default walletStorage;
