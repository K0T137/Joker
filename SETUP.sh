#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          🃏 JOKER CARD GAME - SETUP SCRIPT 🃏             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "${BLUE}[1/4] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 16+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# Setup Backend
echo ""
echo -e "${BLUE}[2/4] Setting up backend...${NC}"
cd backend
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Backend dependencies already installed${NC}"
else
    echo "Installing backend dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend dependencies installed${NC}"
    else
        echo -e "${RED}❌ Backend installation failed${NC}"
        exit 1
    fi
fi
cd ..

# Setup Frontend
echo ""
echo -e "${BLUE}[3/4] Setting up frontend...${NC}"
cd frontend
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
else
    echo "Installing frontend dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
    else
        echo -e "${RED}❌ Frontend installation failed${NC}"
        exit 1
    fi
fi
cd ..

# Validation
echo ""
echo -e "${BLUE}[4/4] Validating project structure...${NC}"

# Check key files
files_to_check=(
    "backend/package.json"
    "backend/server.js"
    "backend/src/gameEngine/Card.js"
    "backend/src/gameEngine/Deck.js"
    "backend/src/gameEngine/GameState.js"
    "backend/src/gameEngine/TrickResolver.js"
    "backend/src/gameEngine/Scorer.js"
    "backend/src/GameRoom.js"
    "frontend/package.json"
    "frontend/vite.config.js"
    "frontend/index.html"
    "frontend/src/main.jsx"
    "frontend/src/App.jsx"
    "frontend/src/index.css"
    "frontend/src/components/Card.jsx"
    "frontend/src/components/GameBoard.jsx"
    "frontend/src/components/GameRoom.jsx"
    "frontend/src/components/BiddingPhase.jsx"
    "frontend/src/components/JoinForm.jsx"
)

missing=0
for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
        ((missing++))
    fi
done

echo ""
if [ $missing -eq 0 ]; then
    echo -e "${GREEN}✅ All files verified!${NC}"
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    SETUP COMPLETE! 🎉                     ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║  To start the game:                                       ║"
    echo "║  Terminal 1: cd backend && npm start                      ║"
    echo "║  Terminal 2: cd frontend && npm run dev                   ║"
    echo "║              Open http://localhost:5173                   ║"
    echo "║                                                           ║"
    echo "║  Then open 4 browser tabs to play!                       ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
else
    echo -e "${RED}⚠️  $missing file(s) missing!${NC}"
    exit 1
fi
