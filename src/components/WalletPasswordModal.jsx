"use client";

import React, { useState, useCallback } from 'react';
import { validatePasswordStrength } from '@/utils/lineraWalletCrypto';

/**
 * WalletPasswordModal - Modal for creating or unlocking Linera wallet
 *
 * Props:
 * - isOpen: boolean - Whether modal is visible
 * - onClose: () => void - Close handler
 * - onSubmit: (password: string) => Promise<void> - Submit handler
 * - mode: 'create' | 'unlock' - Modal mode
 * - isLoading: boolean - Whether submission is in progress
 * - error: string | null - Error message to display
 */
export default function WalletPasswordModal({
  isOpen,
  onClose,
  onSubmit,
  mode = 'unlock',
  isLoading = false,
  error = null,
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isCreateMode = mode === 'create';
  const displayError = error || localError;

  // Password strength validation
  const passwordValidation = validatePasswordStrength(password);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (isCreateMode) {
      // Validate password strength
      if (!passwordValidation.isValid) {
        setLocalError(passwordValidation.feedback);
        return;
      }

      // Check password match
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
    }

    if (!password) {
      setLocalError('Password is required');
      return;
    }

    try {
      await onSubmit(password);
      // Reset form on success
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setLocalError(err.message);
    }
  }, [password, confirmPassword, isCreateMode, passwordValidation, onSubmit]);

  const handleClose = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    onClose();
  }, [onClose]);

  // Strength indicator colors
  const getStrengthColor = (score) => {
    if (score <= 1) return 'bg-red-500';
    if (score <= 2) return 'bg-orange-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-emerald-400';
    return 'bg-emerald-500';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {/* Linera Logo */}
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isCreateMode ? 'Create Wallet' : 'Unlock Wallet'}
              </h2>
              <p className="text-sm text-gray-400">
                {isCreateMode ? 'Secure your new Linera wallet' : 'Enter your password to continue'}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isCreateMode ? 'Create a strong password' : 'Enter your password'}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors pr-12"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Password strength indicator (create mode only) */}
            {isCreateMode && password && (
              <div className="mt-2">
                <div className="flex space-x-1 mb-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= passwordValidation.score
                          ? getStrengthColor(passwordValidation.score)
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${passwordValidation.isValid ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {passwordValidation.feedback}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password field (create mode only) */}
          {isCreateMode && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                disabled={isLoading}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          {/* Info message for create mode */}
          {isCreateMode && (
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg px-4 py-3">
              <p className="text-xs text-emerald-300">
                Your password encrypts your private key locally. If you forget it, you will need to create a new wallet.
              </p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || (isCreateMode && (!passwordValidation.isValid || password !== confirmPassword))}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>{isCreateMode ? 'Creating Wallet...' : 'Unlocking...'}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <span>{isCreateMode ? 'Create Wallet' : 'Unlock'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Powered by <span className="text-emerald-400">Linera</span> Conway Testnet
          </p>
        </div>
      </div>
    </div>
  );
}
