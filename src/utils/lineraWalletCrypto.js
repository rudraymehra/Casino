/**
 * Linera Wallet Cryptography Utilities
 *
 * Provides secure password-based encryption for Linera wallet private keys.
 * Uses PBKDF2 for key derivation and AES-GCM for encryption.
 *
 * Storage format:
 * {
 *   version: 1,
 *   encryptedPrivateKey: "base64...",
 *   salt: "hex...",
 *   iv: "hex...",
 *   owner: "User:abc123...",
 *   chainId: "47e8a6...",
 *   createdAt: timestamp
 * }
 */

const STORAGE_KEY = 'linera_encrypted_wallet';
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Generate a cryptographic salt
 * @returns {Uint8Array} 16-byte random salt
 */
export function generateSalt() {
  const salt = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < 16; i++) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  return salt;
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive an encryption key from a password using PBKDF2
 * @param {string} password - User's password
 * @param {Uint8Array} salt - Cryptographic salt
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
export async function deriveKeyFromPassword(password, salt) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API not available');
  }

  // Import password as raw key material
  const passwordBuffer = new TextEncoder().encode(password);
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypt a private key with a password
 * @param {string} privateKeyHex - Private key as hex string
 * @param {string} password - User's password
 * @returns {Promise<{encryptedPrivateKey: string, salt: string, iv: string}>}
 */
export async function encryptPrivateKey(privateKeyHex, password) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API not available');
  }

  // Generate salt and IV
  const salt = generateSalt();
  const iv = new Uint8Array(12); // 96-bit IV for AES-GCM
  window.crypto.getRandomValues(iv);

  // Derive encryption key from password
  const key = await deriveKeyFromPassword(password, salt);

  // Encrypt private key
  const privateKeyBytes = new TextEncoder().encode(privateKeyHex);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    privateKeyBytes
  );

  // Convert to base64 for storage
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));

  return {
    encryptedPrivateKey: encryptedBase64,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
  };
}

/**
 * Decrypt an encrypted private key with a password
 * @param {{encryptedPrivateKey: string, salt: string, iv: string}} encryptedData
 * @param {string} password - User's password
 * @returns {Promise<string>} Decrypted private key as hex string
 */
export async function decryptPrivateKey(encryptedData, password) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API not available');
  }

  const { encryptedPrivateKey, salt, iv } = encryptedData;

  // Convert from storage formats
  const saltBytes = hexToBytes(salt);
  const ivBytes = hexToBytes(iv);
  const encryptedBytes = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));

  // Derive decryption key from password
  const key = await deriveKeyFromPassword(password, saltBytes);

  try {
    // Decrypt private key
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
      },
      key,
      encryptedBytes
    );

    // Convert back to string
    const privateKeyHex = new TextDecoder().decode(decryptedBuffer);
    return privateKeyHex;
  } catch (error) {
    throw new Error('Invalid password or corrupted data');
  }
}

/**
 * Save encrypted wallet to localStorage
 * @param {object} walletData - Wallet data to save
 */
export function saveEncryptedWallet(walletData) {
  if (typeof window === 'undefined') return;

  const data = {
    version: 1,
    ...walletData,
    createdAt: walletData.createdAt || Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  console.log('Encrypted wallet saved to storage');
}

/**
 * Load encrypted wallet from localStorage
 * @returns {object|null} Encrypted wallet data or null if not found
 */
export function loadEncryptedWallet() {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const data = JSON.parse(saved);
    if (data.version !== 1) {
      console.warn('Unknown wallet storage version:', data.version);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to load encrypted wallet:', error);
    return null;
  }
}

/**
 * Check if an encrypted wallet exists in storage
 * @returns {boolean}
 */
export function hasStoredWallet() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Clear encrypted wallet from storage
 */
export function clearStoredWallet() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  console.log('Encrypted wallet cleared from storage');
}

/**
 * Validate password strength
 * @param {string} password
 * @returns {{isValid: boolean, score: number, feedback: string}}
 */
export function validatePasswordStrength(password) {
  let score = 0;
  const feedback = [];

  if (!password) {
    return { isValid: false, score: 0, feedback: 'Password is required' };
  }

  // Length check
  if (password.length >= 8) {
    score += 1;
    if (password.length >= 12) score += 1;
  } else {
    feedback.push('At least 8 characters');
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One uppercase letter');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One lowercase letter');
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One number');
  }

  // Special character check
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  const isValid = score >= 4 && password.length >= 8;

  return {
    isValid,
    score: Math.min(score, 5),
    feedback: feedback.length > 0 ? 'Missing: ' + feedback.join(', ') : 'Strong password',
  };
}

export default {
  generateSalt,
  deriveKeyFromPassword,
  encryptPrivateKey,
  decryptPrivateKey,
  saveEncryptedWallet,
  loadEncryptedWallet,
  hasStoredWallet,
  clearStoredWallet,
  validatePasswordStrength,
};
