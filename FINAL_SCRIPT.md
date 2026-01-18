# Video Script - Linera Migration Changes

**Total Time:** ~3 minutes

---

## SCENE 1: Show the Problem (20 sec)

**[Screen: Open original GitHub repo in browser]**
https://github.com/AmaanSayyad/APT-Casino-Linera

**SAY:**
> "Original repo used Pyth Entropy on Arbitrum for randomness and a mock Linera server. Not actual Linera deployment."

**[Scroll to show `linera-mock-server.js` in file list]**

---

## SCENE 2: Show New Contracts (60 sec)

**[Screen: Open VS Code]**

### Step 2.1: Show folder structure
**[Open file explorer, expand `linera-contracts/casino/src/`]**

**SAY:**
> "Created Rust smart contracts from scratch. Four game modules."

### Step 2.2: Open `linera-contracts/casino/src/lib.rs`
**[Show lines 18-35]**

**SAY:**
> "Game types and operations defined here. PlaceBet takes commit hash, Reveal verifies and pays out."

### Step 2.3: Open `linera-contracts/casino/src/games/roulette.rs`
**[Show lines 10-25]**

**SAY:**
> "Roulette logic. SHA3 hash to random number 0-36. Deterministic - same seed, same result."

### Step 2.4: Open `linera-contracts/casino/src/contract.rs`
**[Show lines 50-70]**

**SAY:**
> "Contract execution. Verifies commit hash matches reveal value, calculates payout."

---

## SCENE 3: Show Deployment (30 sec)

**[Screen: Terminal]**

**RUN:**
```bash
linera wallet show
```

**SAY:**
> "Deployed to Linera testnet. Real chain, real application ID."

**[Point to Chain ID: `d971cc55...`]**

---

## SCENE 4: Show Tests (30 sec)

**[Screen: Terminal]**

**RUN:**
```bash
cd /Users/rudraym/Linera/APT-Casino-Linera/linera-contracts && cargo test
```

**SAY:**
> "8 unit tests. All games deterministic. All passing."

**[Wait for `8 passed; 0 failed`]**

---

## SCENE 5: Show Contract Query (20 sec)

**[Screen: Terminal]**

**RUN:**
```bash
curl -s http://localhost:8080/chains/d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd/applications/06c20527e6caf34893a14f1019da3c7487530060ed77830ed763b7032566264c -H "Content-Type: application/json" -d '{"query": "{ nextGameId }"}'
```

**SAY:**
> "Contract responding. Game counter working."

**[Show output: `{"data":{"nextGameId":X}}`]**

---

## SCENE 6: Show API Test (30 sec)

**[Screen: Terminal]**

**RUN:**
```bash
curl -s http://localhost:3000/api/linera/place-bet -H "Content-Type: application/json" -d '{"gameType":"Roulette","betAmount":10,"gameParams":{}}'
```

**SAY:**
> "API returns game result with cryptographic proof. Commit hash and reveal value for verification."

**[Point to `commitHash` and `revealValue` in response]**

---

## SCENE 7: Summary (20 sec)

**[Screen: Split view - old GitHub vs new code]**

**SAY:**
> "Summary: Replaced Pyth Entropy with on-chain Rust randomness. Mock server replaced with real Linera testnet deployment. Provably fair, fully on-chain."

---

# Quick Reference

## Files to Show

| Order | File | Lines |
|-------|------|-------|
| 1 | `linera-contracts/casino/src/lib.rs` | 18-35 |
| 2 | `linera-contracts/casino/src/games/roulette.rs` | 10-25 |
| 3 | `linera-contracts/casino/src/contract.rs` | 50-70 |

## Commands to Run

```bash
# 1. Show wallet
linera wallet show

# 2. Run tests
cd /Users/rudraym/Linera/APT-Casino-Linera/linera-contracts && cargo test

# 3. Query contract
curl -s http://localhost:8080/chains/d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd/applications/06c20527e6caf34893a14f1019da3c7487530060ed77830ed763b7032566264c -H "Content-Type: application/json" -d '{"query": "{ nextGameId }"}'

# 4. Test API
curl -s http://localhost:3000/api/linera/place-bet -H "Content-Type: application/json" -d '{"gameType":"Roulette","betAmount":10,"gameParams":{}}'
```

## What Changed - One Slide

| Before | After |
|--------|-------|
| Pyth Entropy (Arbitrum) | Commit-reveal (Linera) |
| Solidity contracts | Rust WASM contracts |
| Mock Linera server | Real testnet deployment |
| External VRF | On-chain randomness |
| Push Chain wallet | MetaMask + Linera |

## Chain Info

```
Chain ID:  d971cc5549dfa14a9a4963c7547192c22bf6c2c8f81d1bb9e5cd06dac63e68fd
App ID:    06c20527e6caf34893a14f1019da3c7487530060ed77830ed763b7032566264c
Network:   Linera Testnet (Conway)
```

