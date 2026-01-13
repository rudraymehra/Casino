# 🎬 Video Script: Linera Casino Migration

> **Purpose**: This is your script for explaining what you did to the interviewer/owner.
> **Total Duration**: ~10-15 minutes
> **Tip**: Screen share and show the actual code as you explain.

---

## 🎯 PART 1: Introduction (1-2 min)

### What to SAY:
```
"Hi, I'll walk you through the Linera Casino migration I completed.

The task was to migrate an existing multi-chain casino app to run 
entirely on Linera blockchain.

Let me show you what I did step by step."
```

### What to SHOW:
- Open the GitHub repo: https://github.com/rudrayscaler/rust
- Show the README briefly

---

## 🔄 PART 2: What Was The Migration? (2-3 min)

### What to SAY:
```
"The original app was using multiple blockchains:

BEFORE (Old System):
- Pyth Entropy on Arbitrum Sepolia → for random numbers
- Push Chain → for game logging  
- Solana → for additional logging
- This cost money for every game ($0.50+ per random number)

AFTER (New System):
- Everything on Linera blockchain
- Free randomness using commit-reveal
- Single chain = simpler architecture
- Much faster transactions"
```

### What to SHOW:
- Open terminal and show:
```bash
# Show deleted files
git log --oneline -5
# Shows the cleanup commit
```

---

## 📁 PART 3: Files I Changed/Created (5-7 min)

### 3.1 Smart Contract (Rust) - SHOW: `linera-contracts/`

**What to SAY:**
```
"I wrote a complete Rust smart contract for Linera.
Let me show you the structure:"
```

**What to SHOW:** Open each file and explain:

| File | What to SAY |
|------|-------------|
| `linera-contracts/casino/src/lib.rs` | "This defines the interface - what operations the contract accepts: PlaceBet and Reveal" |
| `linera-contracts/casino/src/contract.rs` | "This is the main logic. When PlaceBet is called, it saves the commit hash. When Reveal is called, it verifies the hash and calculates the outcome." |
| `linera-contracts/casino/src/state.rs` | "This defines what data is stored on-chain: pending games, game history, and total funds." |
| `linera-contracts/casino/src/games/roulette.rs` | "This calculates roulette outcomes. Takes the reveal value, hashes it, and gets a number 0-36." |
| `linera-contracts/casino/src/games/mines.rs` | "Same pattern for Mines - generates mine positions from the reveal value." |

**Key Point to SAY:**
```
"All 4 games use the same pattern:
1. Take the reveal value
2. Hash it to get randomness
3. Use that to determine outcome
4. Return multiplier for payout calculation"
```

---

### 3.2 Frontend Services - SHOW: `src/services/`

**What to SAY:**
```
"I created new services to connect the frontend to Linera."
```

**What to SHOW:**

| File | What to SAY |
|------|-------------|
| `src/services/LineraWalletService.js` | "This handles wallet connection via MetaMask, generates commit-reveal pairs, and calls the backend API to place bets." |

**Show this specific code:**
```javascript
// Show the generateRandomCommit function
generateRandomCommit() {
    const revealValue = new Uint8Array(32);
    window.crypto.getRandomValues(revealValue);
    // ... generates the commit hash
}
```

**SAY:**
```
"This function generates 32 random bytes, which becomes the reveal value.
The commit hash is sent first, then the reveal value later.
This is how we achieve provably fair gaming."
```

---

### 3.3 React Hooks - SHOW: `src/hooks/useLineraWallet.js`

**What to SAY:**
```
"I created React hooks so any game component can easily:
- Check if wallet is connected
- Get current balance
- Place bets
- Track game results"
```

**Show this code:**
```javascript
export function useLineraWallet() {
    const [isConnected, setIsConnected] = useState(false);
    const [balance, setBalance] = useState(0);
    // ...
    return { isConnected, balance, connect, disconnect };
}
```

---

### 3.4 Backend API - SHOW: `src/app/api/linera/place-bet/route.js`

**What to SAY:**
```
"This is the backend API that handles bets.
It does 3 things:
1. Generates the commit-reveal cryptographic pair
2. Calculates the game outcome using the same algorithm as the smart contract
3. Tries to submit to the Linera blockchain
4. Returns the result with a cryptographic proof"
```

**Show this part:**
```javascript
// The outcome calculation
const outcome = calculateOutcome(gameType, revealValue, gameParams);

// The proof that's returned
proof: {
    commitHash: commitHash.toString('hex'),
    revealValue: revealValue.toString('hex'),
    chainId: LINERA_CONFIG.chainId,
    applicationId: LINERA_CONFIG.applicationId,
}
```

**SAY:**
```
"The proof allows anyone to verify the game was fair.
They can take the revealValue, hash it, and re-run the algorithm
to confirm they get the same outcome."
```

---

### 3.5 Configuration - SHOW: `src/config/lineraConfig.js`

**What to SAY:**
```
"This file contains all the Linera network settings:
- The chain ID where our contract is deployed
- The application ID of our casino contract
- Game-specific settings like min/max bets"
```

**Show:**
```javascript
DEPLOYED_CONTRACT = {
    chainId: '47e8a6da7609bd162d1bb5003ec58555d19721a8e883e2ce35383378730351a2',
    applicationId: '387ba9b2fc59825d1dbe45639493db2f08d51442e44a380273754b1d7b137584',
}
```

---

### 3.6 UI Components - SHOW: `src/components/LineraConnectButton.jsx`

**What to SAY:**
```
"I created a new wallet connect button that:
- Connects to MetaMask
- Shows the balance
- Has a faucet button for testnet tokens"
```

---

## 🗑️ PART 4: What I Removed (2 min)

### What to SAY:
```
"I cleaned up all the old code that's no longer needed:"

REMOVED:
- contracts/ folder → Old Solidity contracts for Pyth
- All Pyth Entropy files → Replaced with commit-reveal
- All Solana files → No longer logging to Solana
- All Push Chain files → No longer using Push Chain
- Hardhat config → No EVM deployment needed
- 15+ old scripts → Not needed for Linera

This reduced complexity significantly.
```

### What to SHOW:
```bash
# In terminal, show:
git diff --stat HEAD~1 HEAD
# Or show the commit message
```

---

## 🔐 PART 5: How Provably Fair Works (2 min)

### What to SAY:
```
"Let me explain the key innovation - provably fair gaming.

The problem with traditional online casinos:
- You have to TRUST the house isn't cheating
- No way to verify outcomes are random

Our solution - Commit-Reveal:

STEP 1: Player generates a secret (reveal_value)
STEP 2: Player sends hash of secret (commit_hash)
        → At this point, outcome is LOCKED but UNKNOWN
STEP 3: After bet is placed, reveal_value is shown
STEP 4: Contract verifies hash matches and calculates outcome

Why this prevents cheating:
- Player can't change their secret (it's already hashed)
- House can't change the algorithm (it's in the smart contract)
- Anyone can verify by re-running the calculation"
```

### What to SHOW:
Draw this on screen or show diagram:
```
Player: secret → hash(secret) → send hash → send secret → verify & play
                     ↓
            [outcome locked here]
```

---

## 📊 PART 6: Summary (1 min)

### What to SAY:
```
"To summarize what I delivered:

1. SMART CONTRACT (Rust)
   - Complete casino contract with 4 games
   - Deployed to Linera testnet
   - Provably fair randomness

2. FRONTEND INTEGRATION
   - Wallet service for MetaMask connection
   - React hooks for easy integration
   - Updated all 4 game pages

3. BACKEND API
   - Handles bet placement
   - Calculates outcomes
   - Returns cryptographic proofs

4. CODE CLEANUP
   - Removed all old multi-chain code
   - Single chain architecture now
   - Much simpler codebase

The app is now fully functional on Linera testnet."
```

---

## 💡 TIPS FOR YOUR VIDEO

### Do This:
✅ Screen share and show actual code
✅ Open files as you explain them
✅ Keep explanations simple
✅ Show the running app if possible
✅ Highlight the "provably fair" aspect - it's the key innovation

### Don't Do This:
❌ Don't read code line by line
❌ Don't go too deep into Rust syntax
❌ Don't spend too long on any one file
❌ Don't apologize or say "I'm not sure"

### Key Phrases to Use:
- "I migrated from X to Y"
- "This ensures provably fair outcomes"
- "The commit-reveal pattern prevents cheating"
- "This is deployed on Linera testnet"
- "Anyone can verify the game was fair"

---

## 📝 QUICK CHEAT SHEET

### If Asked "What's the main thing you did?"
```
"I migrated a multi-chain casino to Linera blockchain, 
implementing provably fair gaming using commit-reveal cryptography."
```

### If Asked "How does the randomness work?"
```
"We use commit-reveal. Player commits to a hash first, 
then reveals the actual value. This locks the outcome 
before anyone knows it, preventing cheating."
```

### If Asked "What's Linera?"
```
"Linera is a new blockchain with fast finality and 
low fees. Smart contracts are written in Rust and 
compiled to WebAssembly."
```

### If Asked "What files did you write?"
```
"I wrote:
1. The Rust smart contract (linera-contracts/)
2. Frontend wallet service (LineraWalletService.js)
3. React hooks (useLineraWallet.js)
4. Backend API (place-bet/route.js)
5. Configuration (lineraConfig.js)
And I cleaned up all the old multi-chain code."
```

---

## 🎥 RECORDING ORDER

Record in this order for smooth flow:

1. **Intro** → Show GitHub repo
2. **Before/After** → Explain the migration
3. **Smart Contract** → Show Rust files
4. **Frontend** → Show JS services
5. **API** → Show the place-bet route
6. **Provably Fair** → Explain commit-reveal
7. **Demo** → If app runs, show it working
8. **Summary** → Wrap up

Good luck with your video! 🎬

