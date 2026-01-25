#!/bin/bash
# ============================================
# APT Casino - Linera Contract Deployment Script
# ============================================

set -e  # Exit on error

echo "🎰 APT Casino - Linera Contract Deployment"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FAUCET_URL="https://faucet.testnet-conway.linera.net"
NETWORK="testnet-conway"

# Step 1: Check Linera CLI
echo ""
echo "📋 Step 1: Checking Linera CLI..."
if ! command -v linera &> /dev/null; then
    echo -e "${RED}❌ Linera CLI not found. Installing...${NC}"
    cargo install linera-service
fi
linera --version

# Step 2: Initialize wallet (if not already done)
echo ""
echo "📋 Step 2: Initializing Linera wallet..."
WALLET_DIR="$HOME/.linera"

if [ ! -f "$WALLET_DIR/wallet.json" ]; then
    echo "Creating new wallet from faucet..."
    linera wallet init --faucet "$FAUCET_URL" --with-new-chain
    echo -e "${GREEN}✅ Wallet created${NC}"
else
    echo -e "${YELLOW}⚠️  Wallet already exists at $WALLET_DIR${NC}"
    echo "Using existing wallet..."
fi

# Step 3: Build the contract
echo ""
echo "📋 Step 3: Building casino contract..."
cd "$(dirname "$0")"

echo "Building for wasm32..."
cargo build --release --target wasm32-unknown-unknown

# Check if build succeeded
CONTRACT_WASM="target/wasm32-unknown-unknown/release/casino_contract.wasm"
SERVICE_WASM="target/wasm32-unknown-unknown/release/casino_service.wasm"

if [ ! -f "$CONTRACT_WASM" ]; then
    echo -e "${RED}❌ Contract WASM not found at $CONTRACT_WASM${NC}"
    exit 1
fi

if [ ! -f "$SERVICE_WASM" ]; then
    echo -e "${RED}❌ Service WASM not found at $SERVICE_WASM${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract built successfully${NC}"
echo "   Contract: $CONTRACT_WASM"
echo "   Service:  $SERVICE_WASM"

# Step 4: Publish bytecode
echo ""
echo "📋 Step 4: Publishing bytecode to Linera..."

BYTECODE_ID=$(linera publish-bytecode "$CONTRACT_WASM" "$SERVICE_WASM" 2>&1 | tee /dev/tty | grep -oE '[a-f0-9]{64}' | head -1)

if [ -z "$BYTECODE_ID" ]; then
    echo -e "${RED}❌ Failed to publish bytecode${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Bytecode published: $BYTECODE_ID${NC}"

# Step 5: Create application
echo ""
echo "📋 Step 5: Creating casino application..."

# Initial funds for casino treasury (in attos: 1000 = 1000 LINERA initial funds)
INITIAL_FUNDS="1000"

# Create application with initial funds
APP_ID=$(linera create-application "$BYTECODE_ID" --json-argument "$INITIAL_FUNDS" 2>&1 | tee /dev/tty | grep -oE '[a-f0-9]{64}' | tail -1)

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Failed to create application${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Application created: $APP_ID${NC}"

# Step 6: Get chain ID
echo ""
echo "📋 Step 6: Getting chain information..."
CHAIN_ID=$(linera wallet show 2>&1 | grep -oE 'e[a-f0-9]{63}|[a-f0-9]{64}' | head -1)

if [ -z "$CHAIN_ID" ]; then
    echo -e "${YELLOW}⚠️  Could not auto-detect chain ID. Check 'linera wallet show'${NC}"
else
    echo -e "${GREEN}✅ Chain ID: $CHAIN_ID${NC}"
fi

# Step 7: Output configuration
echo ""
echo "==========================================="
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo "==========================================="
echo ""
echo "Add these to your .env.local file:"
echo ""
echo "NEXT_PUBLIC_LINERA_CHAIN_ID=$CHAIN_ID"
echo "NEXT_PUBLIC_LINERA_APP_ID=$APP_ID"
echo ""
echo "Explorer Links:"
echo "  Chain: https://explorer.testnet-conway.linera.net/chains/$CHAIN_ID"
echo "  App:   https://explorer.testnet-conway.linera.net/applications/$APP_ID"
echo ""
echo "GraphQL Endpoint:"
echo "  https://rpc.testnet-conway.linera.net/chains/$CHAIN_ID/applications/$APP_ID"
echo ""

# Save to file for reference
cat > deployment-output.txt << EOF
# APT Casino Deployment Output
# Generated: $(date)

CHAIN_ID=$CHAIN_ID
APP_ID=$APP_ID
BYTECODE_ID=$BYTECODE_ID

# Environment Variables for .env.local:
NEXT_PUBLIC_LINERA_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_LINERA_APP_ID=$APP_ID

# Explorer Links:
Chain Explorer: https://explorer.testnet-conway.linera.net/chains/$CHAIN_ID
Application: https://explorer.testnet-conway.linera.net/applications/$APP_ID

# GraphQL Endpoint:
https://rpc.testnet-conway.linera.net/chains/$CHAIN_ID/applications/$APP_ID
EOF

echo "📄 Deployment info saved to: deployment-output.txt"
echo ""
echo "Next steps:"
echo "1. Copy the CHAIN_ID and APP_ID to your .env.local file"
echo "2. Restart your Next.js server: npm run dev"
echo "3. Test the APIs: curl http://localhost:3000/api/deposit"
