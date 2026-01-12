# Linera Integration Guide

## Overview

APT Casino is integrated with the Linera blockchain for on-chain game outcomes and provably fair gaming. This document describes the integration architecture and how to use it.

## Deployed Contract

- **Network**: Linera Conway Testnet
- **Chain ID**: `47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2`
- **Application ID**: `387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584`
- **SDK Version**: `0.15.8`
- **Deployed At**: `2026-01-11T13:19:37.751Z`

## Environment Variables

Add these to your `.env.local` file:

```bash
# Linera Network URLs
NEXT_PUBLIC_LINERA_RPC=https://testnet-conway.linera.net
NEXT_PUBLIC_LINERA_EXPLORER=https://explorer.testnet-conway.linera.net
NEXT_PUBLIC_LINERA_FAUCET=https://faucet.testnet-conway.linera.net

# Deployed Casino Contract
NEXT_PUBLIC_LINERA_CHAIN_ID=47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2
NEXT_PUBLIC_LINERA_APP_ID=387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584
```

## Architecture

### Smart Contract (Rust)

Location: `linera-contracts/casino/`

The casino contract implements:
- **Commit-Reveal Scheme**: Players commit to a hash, then reveal to determine outcome
- **On-chain Randomness**: Verifiable random outcomes using SHA3-256
- **Game Logic**: Roulette, Plinko, Mines, and Wheel games
- **State Management**: RootView for persistent game history

### Frontend Integration

#### Services
- `src/services/LineraWalletService.js`: Wallet connection and GraphQL operations
- `src/hooks/useLineraWallet.js`: React hooks for wallet and game state

#### Components
- `src/components/LineraGameWrapper.jsx`: HOC for game integration
- `src/components/LineraWalletButton.jsx`: Wallet connection UI

## How Games Work

### 1. Commit Phase
1. Player selects bet amount and game parameters
2. Frontend generates 32 bytes of random data (`revealValue`)
3. SHA3-256 hash of `revealValue` is computed (`commitHash`)
4. Contract stores the bet with `commitHash`

### 2. Reveal Phase
1. Player sends `revealValue` to the contract
2. Contract verifies `SHA3(revealValue) == commitHash`
3. Game outcome is deterministically computed from `revealValue`
4. Payout is calculated and state is updated

### Commit-Reveal Security
- The player commits to a value before knowing the outcome
- The blockchain time and other factors cannot be manipulated
- The outcome is provably fair and verifiable

## Game Types

### Roulette
- Numbers: 0-36
- Bet types: straight (single number), color, odd/even, high/low
- Game params format: `"bet_type:value"` (e.g., `"number:17"` or `"color:red"`)

### Plinko
- Rows: 8-16
- Ball path generated bit-by-bit from random hash
- Game params format: `"rows"` (e.g., `"12"`)

### Mines
- Grid: 5x5 (25 cells)
- Mines: 1-24
- Fisher-Yates shuffle for mine placement
- Game params format: `"num_mines:cells_revealed"` (e.g., `"5:8"`)

### Wheel
- Segments: 8
- Various multipliers including jackpot (10x)
- Game params format: empty string

## GraphQL API

### Queries

```graphql
query {
  nextGameId
  totalFunds
  gameHistory {
    gameId
    gameType
    betAmount
    payoutAmount
    outcomeDetails
    timestamp
  }
}
```

### Mutations

```graphql
mutation {
  placeBet(
    gameType: "Mines"
    betAmount: "1000000000000000000"
    commitHash: "abc123..."
    gameParams: "5:0"
  )
}

mutation {
  reveal(
    gameId: 1
    revealValue: "def456..."
  )
}
```

## Usage Example

```javascript
import { useLineraWallet, useLineraGame } from '@/hooks/useLineraWallet';

function MinesGame() {
  const { isConnected, connect } = useLineraWallet();
  const { playGame, gameResult, isPlacingBet } = useLineraGame();

  const handlePlay = async () => {
    if (!isConnected) {
      await connect();
    }

    const result = await playGame(
      'Mines',
      '1000000000000000000', // 1 LINERA in attos
      '5:0' // 5 mines, 0 revealed initially
    );

    console.log('Game result:', result);
  };

  return (
    <button onClick={handlePlay} disabled={isPlacingBet}>
      {isPlacingBet ? 'Playing...' : 'Play Mines'}
    </button>
  );
}
```

## Development

### Building Contracts

```bash
cd linera-contracts
cargo build --release --target wasm32-unknown-unknown
```

### Deploying Contracts

```bash
linera publish-and-create \
    target/wasm32-unknown-unknown/release/casino_contract.wasm \
    target/wasm32-unknown-unknown/release/casino_service.wasm \
    --json-argument '0'
```

### Testing Locally

Start the local Linera node:
```bash
npm run linera:local
```

Or use the mock server:
```bash
node linera-mock-server.js
```

## Troubleshooting

### "Wallet not connected"
Ensure MetaMask is installed and the user has connected their wallet.

### "Invalid reveal value"
The reveal value must match the original commit hash. This error indicates a mismatch.

### "Game not found"
The game ID doesn't exist or has already been revealed.

## Resources

- [Linera Documentation](https://linera.dev/)
- [Linera SDK](https://github.com/linera-io/linera-protocol)
- [Conway Testnet Explorer](https://explorer.testnet-conway.linera.net)
- [Faucet](https://faucet.testnet-conway.linera.net)

