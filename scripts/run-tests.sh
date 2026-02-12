#!/bin/bash

###############################################################################
# Robust Test Runner Script
#
# Este script garante que todos os testes sejam executados de forma confiável:
# - Mata processos antigos do servidor de dev
# - Sobe novo servidor em background
# - Aguarda servidor estar pronto
# - Executa todos os testes
# - Limpa processos ao finalizar
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Iniciando testes robustos...${NC}"

# Kill any existing dev servers on port 3000
echo -e "${YELLOW}🔍 Verificando processos na porta 3000...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait a bit to ensure port is free
sleep 1

# Start dev server in background
echo -e "${YELLOW}🚀 Subindo servidor de desenvolvimento...${NC}"
npm run dev > /dev/null 2>&1 &
DEV_PID=$!

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🧹 Limpando processos...${NC}"
    kill $DEV_PID 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
}

# Register cleanup function
trap cleanup EXIT

# Wait for server to be ready (max 30 seconds)
echo -e "${YELLOW}⏳ Aguardando servidor ficar pronto...${NC}"
MAX_WAIT=30
WAITED=0
until curl -s http://localhost:3000 > /dev/null || [ $WAITED -eq $MAX_WAIT ]; do
    sleep 1
    WAITED=$((WAITED + 1))
    echo -n "."
done
echo ""

if [ $WAITED -eq $MAX_WAIT ]; then
    echo -e "${RED}❌ Servidor não ficou pronto em ${MAX_WAIT}s${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Servidor pronto!${NC}"

# Run all tests
echo -e "${YELLOW}🧪 Executando testes...${NC}"
npx playwright test

# Check test exit code
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
    exit 0
else
    echo -e "${RED}❌ Alguns testes falharam${NC}"
    exit 1
fi
