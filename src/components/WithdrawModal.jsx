"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaWallet, FaCoins, FaArrowRight, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { useSelector, useDispatch } from 'react-redux';
import { setBalance } from '@/store/balanceSlice';
import { lineraWalletService } from '@/services/LineraWalletService';
import { toast } from 'react-toastify';

// Treasury wallet address - get from environment variables
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || process.env.TREASURY_ADDRESS || "0xb424d2369F07b925D1218B08e56700AF5928287b";

const WithdrawModal = ({ isOpen, onClose }) => {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState('input'); // 'input', 'confirm', 'processing', 'success', 'error'
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  const { userBalance } = useSelector((state) => state.balance);
  const dispatch = useDispatch();

  // Listen for Linera wallet changes
  useEffect(() => {
    setIsConnected(lineraWalletService.isConnected());
    setAddress(lineraWalletService.userAddress);

    const unsubscribe = lineraWalletService.addListener((event, data) => {
      if (event === 'connected') {
        setIsConnected(true);
        setAddress(data?.address);
      } else if (event === 'disconnected') {
        setIsConnected(false);
        setAddress(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Display balance LINERA format
  const balanceInPC = parseFloat(userBalance || '0') / 100000000;
  const maxWithdraw = Math.max(0, balanceInPC - 0.01); // Reserve 0.01 for fees

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setWithdrawAmount('');
      setError('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setWithdrawAmount(value);
      setError('');
    }
  };

  const validateWithdraw = () => {
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (amount > maxWithdraw) {
      setError(`Insufficient balance. Max withdraw: ${maxWithdraw.toFixed(4)} LINERA`);
      return false;
    }

    if (amount < 0.001) {
      setError('Minimum withdraw amount is 0.001 LINERA');
      return false;
    }

    return true;
  };

  const handleWithdraw = async () => {
    if (!validateWithdraw()) return;

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    setStep('confirm');
  };

  const confirmWithdraw = async () => {
    setStep('processing');
    setIsProcessing(true);

    try {
      const amount = parseFloat(withdrawAmount);

      // Call backend API to process withdrawal
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: address,
          amount: amount
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Withdrawal failed');
      }

      // Deduct from user's balance
      const amountOctas = Math.floor(amount * 100000000);
      const currentBalanceOctas = parseInt(userBalance || '0');
      const newBalanceOctas = currentBalanceOctas - amountOctas;
      dispatch(setBalance(newBalanceOctas.toString()));

      // Also update LineraWalletService balance to keep it in sync
      lineraWalletService.setBalance(newBalanceOctas / 100000000);

      setStep('success');
      toast.success(`Successfully withdrew ${amount} LINERA! TX: ${result.transactionHash?.slice(0, 8) || 'pending'}...`);

      // Close modal after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error) {
      console.error('Withdraw error:', error);
      setError(`Withdraw failed: ${error.message}`);
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'input':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaWallet className="text-2xl text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Withdraw LINERA</h3>
              <p className="text-gray-400">Transfer your winnings to your Linera wallet</p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Available Balance:</span>
                <span className="text-white font-bold">{balanceInPC.toFixed(4)} LINERA</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Max Withdraw:</span>
                <span className="text-emerald-400 font-bold">{maxWithdraw.toFixed(4)} LINERA</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Withdraw Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={handleAmountChange}
                  placeholder="0.0000"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() => setWithdrawAmount(maxWithdraw.toString())}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                >
                  MAX
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-sm mt-2 flex items-center">
                  <FaExclamationTriangle className="mr-1" />
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                Continue
                <FaArrowRight />
              </button>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaExclamationTriangle className="text-2xl text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Confirm Withdrawal</h3>
              <p className="text-gray-400">Please review your withdrawal details</p>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Withdraw Amount:</span>
                <span className="text-white font-bold">{withdrawAmount} LINERA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">To Wallet:</span>
                <span className="text-white font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Fee:</span>
                <span className="text-yellow-400">~0.001 LINERA</span>
              </div>
              <hr className="border-gray-600" />
              <div className="flex justify-between">
                <span className="text-gray-400">You'll Receive:</span>
                <span className="text-emerald-400 font-bold">{(parseFloat(withdrawAmount) - 0.001).toFixed(4)} LINERA</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={confirmWithdraw}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-lg text-white font-medium transition-all"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Processing Withdrawal</h3>
            <p className="text-gray-400">Please wait while we process your withdrawal...</p>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white font-bold">{withdrawAmount} LINERA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-emerald-400">Processing...</span>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheck className="text-2xl text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Withdrawal Successful!</h3>
            <p className="text-gray-400">Your LINERA has been sent to your wallet</p>

            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Amount Sent:</span>
                <span className="text-emerald-400 font-bold">{withdrawAmount} LINERA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">To Wallet:</span>
                <span className="text-white font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>
            </div>

            <p className="text-sm text-gray-500">This modal will close automatically in a few seconds...</p>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTimes className="text-2xl text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Withdrawal Failed</h3>
            <p className="text-gray-400">There was an error processing your withdrawal</p>

            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step !== 'processing' && step !== 'success' && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes />
              </button>
            )}

            {renderStep()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WithdrawModal;
