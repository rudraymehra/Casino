# Linera Casino Smart Contract Specification

## Overview

This document specifies the Linera smart contract required for the APT Casino frontend to function. The frontend makes GraphQL mutations/queries to this contract.

## Contract Requirements

### Network Configuration

```
Network: Linera Conway Testnet
RPC: https://rpc.testnet-conway.linera.net
Faucet: https://faucet.testnet-conway.linera.net
Explorer: https://explorer.testnet-conway.linera.net
```

### GraphQL Endpoint Format

```
{RPC_URL}/chains/{CHAIN_ID}/applications/{APPLICATION_ID}
```

Example:
```
https://rpc.testnet-conway.linera.net/chains/d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd/applications/e230e675d2ade7ac7c3351d57c7dff2ff59c7ade94cb615ebe77149113b6d194
```

---

## Required GraphQL Schema

### Mutations

#### 1. `deposit` - Deposit tokens to casino

```graphql
mutation Deposit($amount: String!) {
  deposit(amount: $amount) {
    newBalance
  }
}
```

**Parameters:**
- `amount`: String - Amount in attos (1 LINERA = 10^18 attos)

**Response:**
```json
{
  "data": {
    "deposit": {
      "newBalance": "100000000000000000000"
    }
  }
}
```

---

#### 2. `withdraw` - Withdraw tokens from casino

```graphql
mutation Withdraw($amount: String!) {
  withdraw(amount: $amount) {
    newBalance
  }
}
```

**Parameters:**
- `amount`: String - Amount in attos

**Response:**
```json
{
  "data": {
    "withdraw": {
      "newBalance": "50000000000000000000"
    }
  }
}
```

---

#### 3. `placeBet` - Place a bet on a game

```graphql
mutation PlaceBet(
  $gameType: String!
  $betAmount: String!
  $commitHash: [Int!]!
  $gameParams: String!
) {
  placeBet(
    gameType: $gameType
    betAmount: $betAmount
    commitHash: $commitHash
    gameParams: $gameParams
  ) {
    gameId
  }
}
```

**Parameters:**
- `gameType`: String - One of: "Roulette", "Plinko", "Mines", "Wheel"
- `betAmount`: String - Amount in attos
- `commitHash`: [Int!] - 32-byte SHA3-256 hash as array of integers
- `gameParams`: String - JSON string with game-specific parameters

**Response:**
```json
{
  "data": {
    "placeBet": {
      "gameId": 12345
    }
  }
}
```

---

#### 4. `reveal` - Reveal the random value to finalize game

```graphql
mutation Reveal($gameId: Int!, $revealValue: [Int!]!) {
  reveal(gameId: $gameId, revealValue: $revealValue) {
    gameId
    outcome
    payout
  }
}
```

**Parameters:**
- `gameId`: Int - Game ID from placeBet response
- `revealValue`: [Int!] - 32-byte reveal value as array of integers

**Response:**
```json
{
  "data": {
    "reveal": {
      "gameId": 12345,
      "outcome": "Roulette: 17 Red",
      "payout": "360000000000000000000"
    }
  }
}
```

---

### Queries

#### 1. `getBalance` - Get player's casino balance

```graphql
query GetBalance($owner: String!) {
  getBalance(owner: $owner)
}
```

**Response:**
```json
{
  "data": {
    "getBalance": "100000000000000000000"
  }
}
```

---

#### 2. `getGameState` - Get current game state

```graphql
query GetGameState($gameId: Int!) {
  getGameState(gameId: $gameId) {
    gameId
    gameType
    player
    betAmount
    status
    outcome
    payout
  }
}
```

---

#### 3. `gameHistory` - Get game history

```graphql
query {
  gameHistory {
    gameId
    gameType
    betAmount
    payoutAmount
    outcomeDetails
  }
}
```

---

## Game Logic Implementation

### Commit-Reveal Scheme

The contract MUST implement commit-reveal for provably fair randomness:

1. **Commit Phase** (`placeBet`):
   - Player sends `commitHash = SHA3-256(revealValue)`
   - Contract stores the commit hash with the bet

2. **Reveal Phase** (`reveal`):
   - Player sends original `revealValue`
   - Contract verifies: `SHA3-256(revealValue) == storedCommitHash`
   - Contract computes outcome using `revealValue` as seed

### Game Outcome Algorithms

The contract MUST use these EXACT algorithms (matching frontend):

#### Roulette
```rust
fn calculate_roulette_outcome(seed: &[u8; 32]) -> u8 {
    let seed_number = u32::from_be_bytes([seed[0], seed[1], seed[2], seed[3]]);
    (seed_number % 37) as u8  // 0-36
}
```

#### Plinko
```rust
fn calculate_plinko_outcome(seed: &[u8; 32], rows: u8) -> u8 {
    let mut position = rows / 2;
    for i in 0..rows {
        let byte_index = (i / 8) as usize;
        let bit_index = i % 8;
        let go_right = (seed[byte_index % 32] >> bit_index) & 1;
        if go_right == 1 {
            position = position.saturating_add(1).min(rows);
        } else {
            position = position.saturating_sub(1);
        }
    }
    position
}
```

#### Mines
```rust
fn calculate_mines_positions(seed: &[u8; 32], total_cells: u8, num_mines: u8) -> Vec<u8> {
    let mut mines = Vec::new();
    let mut available: Vec<u8> = (0..total_cells).collect();

    for i in 0..num_mines {
        let extended_seed = [seed.as_slice(), &[i]].concat();
        let hash = sha3_256(&extended_seed);
        let random_value = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
        let index = (random_value as usize) % available.len();
        mines.push(available.remove(index));
    }
    mines
}
```

#### Wheel
```rust
fn calculate_wheel_outcome(seed: &[u8; 32], segments: u8) -> u8 {
    let seed_number = u32::from_be_bytes([seed[0], seed[1], seed[2], seed[3]]);
    (seed_number % segments as u32) as u8
}
```

---

## Payout Multipliers

### Roulette
| Bet Type | Multiplier |
|----------|------------|
| Straight (single number) | 36x |
| Color (red/black) | 2x |
| Odd/Even | 2x |
| High/Low | 2x |
| Dozen | 3x |
| Column | 3x |
| Split | 18x |
| Street | 12x |
| Corner | 9x |

### Wheel (8 segments)
```
Segments: [1x, 1.5x, 2x, 0.5x, 3x, 1x, 5x, 0.5x]
```

### Plinko
Multiplier based on distance from center:
```
Center: 1x
Distance 1: 1.2x
Distance 2: 1.5x
Distance 3: 2x
Distance 4: 5x
Distance 5+: 10x+
```

### Mines
```rust
fn mines_multiplier(safe_revealed: u8, total_cells: u8, num_mines: u8) -> f64 {
    let safe_cells = total_cells - num_mines;
    let mut multiplier = 1.0;
    for i in 0..safe_revealed {
        multiplier *= (total_cells - i) as f64 / (safe_cells - i) as f64;
    }
    multiplier
}
```

---

## Deployment Instructions

### 1. Build the Linera Application

```bash
cd linera-casino-contract
cargo build --release --target wasm32-unknown-unknown
```

### 2. Deploy to Linera Testnet

```bash
# Initialize wallet
linera wallet init --faucet https://faucet.testnet-conway.linera.net

# Create application
linera create-application \
  target/wasm32-unknown-unknown/release/casino_contract.wasm \
  --json-parameters '{}'
```

### 3. Update Frontend Configuration

After deployment, update `.env.local`:

```bash
NEXT_PUBLIC_LINERA_CHAIN_ID=<your-chain-id>
NEXT_PUBLIC_LINERA_APP_ID=<your-application-id>
```

---

## Testing

### Test Deposit
```bash
curl -X POST http://localhost:3000/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x...", "amount": 10}'
```

### Test Place Bet
```bash
curl -X POST http://localhost:3000/api/linera/place-bet \
  -H "Content-Type: application/json" \
  -d '{"gameType": "Roulette", "betAmount": 1, "gameParams": {"betType": "color", "betValue": "red"}}'
```

### Test Withdraw
```bash
curl -X POST http://localhost:3000/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{"userAddress": "0x...", "amount": 5}'
```

---

## Current Status

**IMPORTANT:** The frontend is ready but the smart contract needs to be deployed.

Currently, all API calls to the casino contract will fail with:
```json
{
  "success": false,
  "error": "Blockchain unavailable - cannot process bet",
  "details": {
    "hint": "The casino smart contract may not be deployed or the Linera node is unreachable"
  }
}
```

The faucet API works (it talks to the official Linera faucet, not the casino contract).

---

## Contact

For questions about this specification, contact the development team.
