/**
 * Deposit API - Records user deposits to the casino
 * This endpoint is called after a user sends funds to the treasury
 */

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment configuration
const RPC_URL = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || process.env.TREASURY_ADDRESS || '';

// Deposit limits
const MIN_DEPOSIT = 0.001; // Minimum 0.001 PC
const MAX_DEPOSIT = 10000;  // Maximum 10000 PC

export async function POST(request) {
  try {
    const body = await request.json();
    const { userAddress, amount, transactionHash } = body;

    // Validate request
    if (!userAddress) {
      return NextResponse.json(
        { success: false, error: 'User address is required' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    const depositAmount = parseFloat(amount);

    // Validate amount limits
    if (depositAmount < MIN_DEPOSIT) {
      return NextResponse.json(
        { success: false, error: `Minimum deposit is ${MIN_DEPOSIT} PC` },
        { status: 400 }
      );
    }

    if (depositAmount > MAX_DEPOSIT) {
      return NextResponse.json(
        { success: false, error: `Maximum deposit is ${MAX_DEPOSIT} PC` },
        { status: 400 }
      );
    }

    // Validate user address format
    if (!ethers.isAddress(userAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    console.log(`💰 Processing deposit: ${depositAmount} PC from ${userAddress}`);
    console.log(`📋 Transaction hash: ${transactionHash || 'N/A'}`);

    // If transaction hash is provided, verify it on-chain
    if (transactionHash && transactionHash.startsWith('0x') && transactionHash.length === 66) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        
        if (receipt) {
          console.log(`✅ Transaction verified: Block ${receipt.blockNumber}, Status: ${receipt.status}`);
          
          if (receipt.status !== 1) {
            return NextResponse.json(
              { success: false, error: 'Transaction failed on-chain' },
              { status: 400 }
            );
          }
        } else {
          console.log('⏳ Transaction receipt not found yet, deposit will be pending');
        }
      } catch (verifyError) {
        console.warn('Could not verify transaction:', verifyError.message);
        // Continue anyway - transaction might still be pending
      }
    }

    // Record the deposit (in a production system, this would go to a database)
    const depositRecord = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userAddress,
      amount: depositAmount,
      transactionHash: transactionHash || null,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    console.log(`✅ Deposit recorded:`, depositRecord);

    return NextResponse.json({
      success: true,
      depositId: depositRecord.id,
      amount: depositAmount,
      userAddress,
      transactionHash: transactionHash || null,
      message: `Successfully deposited ${depositAmount} PC`,
    });

  } catch (error) {
    console.error('❌ Deposit error:', error);

    return NextResponse.json(
      { success: false, error: error.message || 'Deposit failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check deposit status/limits
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Deposit API',
    limits: {
      min: MIN_DEPOSIT,
      max: MAX_DEPOSIT,
    },
    treasuryAddress: TREASURY_ADDRESS || 'Not configured',
  });
}




