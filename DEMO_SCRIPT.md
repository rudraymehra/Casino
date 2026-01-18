# 🎬 Linera Casino Migration - Demo Script

**Duration:** 3-4 minutes  
**Format:** Screen recording with voiceover

---

## INTRO (10 seconds)

**[Screen: Terminal with tests passing]**

> "Here's the Linera Casino migration. I'll show you the contract, deployment, and working demo."

---

## PART 1: THE RUST CONTRACTS (60 seconds)

### Show: `linera-contracts/casino/src/lib.rs`

**[Open file, scroll to line 20-50]**

> "Wrote Rust smart contracts for Linera. Four games - Roulette, Mines, Plinko, Wheel."

**Show these lines:**
```rust
pub enum GameType {
    Roulette,
    Plinko,
    Mines,
    Wheel,
}
```

> "Each game uses commit-reveal for provably fair randomness."

---

### Show: `linera-contracts/casino/src/games/roulette.rs`

**[Open file, show lines 10-30]**

> "Game logic in Rust. Takes reveal value, generates deterministic outcome."

**Highlight:**
```rust
let random_u32 = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]);
let result = random_u32 % 37; // 0-36
```

> "Same seed = same result. Verifiable on-chain."

---

### Show: `linera-contracts/casino/src/contract.rs`

**[Show lines 40-60]**

> "Contract handles PlaceBet and Reveal operations."

**Highlight:**
```rust
CasinoOperation::PlaceBet { game_type, bet_amount, commit_hash, game_params }
CasinoOperation::Reveal { game_id, reveal_value }
```

---

## PART 2: DEPLOYMENT PROOF (30 seconds)

### Show: Terminal

**[Run command]**
```bash
linera wallet show
```

> "Contract deployed to Linera testnet."

**[Run command]**
```bash
curl -s http://localhost:8080/chains/d971cc5549.../applications/06c20527... \
  -H "Content-Type: application/json" \
  -d '{"query": "{ nextGameId }"}'
```

**[Show output: `{"data":{"nextGameId":1}}`]**

> "Contract responding. Game counter at 1."

---

## PART 3: TESTS PASSING (30 seconds)

### Show: Terminal

**[Run command]**
```bash
cd linera-contracts && cargo test
```

**[Wait for output]**

> "8 unit tests. All passing."

**Highlight output:**
```
test result: ok. 8 passed; 0 failed
```

---

## PART 4: LIVE API TEST (45 seconds)

### Show: Terminal

**[Run command]**
```bash
curl -s http://localhost:3000/api/linera/place-bet \
  -H "Content-Type: application/json" \
  -d '{"gameType":"Roulette","betAmount":10,"gameParams":{}}'
```

**[Show JSON response]**

> "API returns game result, payout, and cryptographic proof."

**Highlight in response:**
```json
{
  "success": true,
  "outcome": "Landed on 21 (red)",
  "payout": 20,
  "proof": {
    "commitHash": "9f33c7b...",
    "revealValue": "dfaa30d..."
  }
}
```

> "Commit hash and reveal value - provably fair. Anyone can verify."

---

## PART 5: FRONTEND (30 seconds)

### Show: Browser at http://localhost:3000

**[Navigate to /game/roulette]**

> "Frontend connects to Linera. Wallet integration, game UI."

**[Click "Connect Wallet" button]**

**[Show game interface]**

---

## WRAP UP (15 seconds)

**[Show terminal with passing tests]**

> "Summary: Rust contracts, deployed on Linera testnet, provably fair gaming, all tests passing."

---

## KEY FILES TO SHOW

| What | File Path |
|------|-----------|
| Main Contract | `linera-contracts/casino/src/lib.rs` |
| Game Logic | `linera-contracts/casino/src/games/roulette.rs` |
| Contract Ops | `linera-contracts/casino/src/contract.rs` |
| API Endpoint | `src/app/api/linera/place-bet/route.js` |
| Wallet Service | `src/services/LineraWalletService.js` |

---

## COMMANDS TO RUN LIVE

```bash
# Show wallet
linera wallet show

# Query contract
curl -s http://localhost:8080/chains/d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd/applications/06c20527e6caf34893a14f1019da3c7487530060ed77830ed763b7032566264c -H "Content-Type: application/json" -d '{"query": "{ nextGameId }"}'

# Run tests
cargo test

# Test API
curl -s http://localhost:3000/api/linera/place-bet -H "Content-Type: application/json" -d '{"gameType":"Roulette","betAmount":10,"gameParams":{}}'
```

---

## WHAT CHANGED (Migration Summary)

| Before | After |
|--------|-------|
| Pyth Entropy (Arbitrum) | Linera commit-reveal |
| Solidity contracts | Rust WASM contracts |
| Push Chain wallet | MetaMask + Linera |
| Multiple chains | Single Linera chain |
| External VRF | On-chain randomness |

---

## CHAIN INFO (For Reference)

```
Network:   Linera Testnet (Conway)
Chain ID:  d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd
App ID:    06c20527e6caf34893a14f1019da3c7487530060ed77830ed763b7032566264c
Explorer:  https://explorer.testnet-conway.linera.net
```

