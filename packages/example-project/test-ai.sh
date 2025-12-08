#!/bin/bash

# MrklTree AI Integration Test Script

echo "🤖 MrklTree AI Integration Test"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️ No .env file found. Creating from template..."
    cp env.example .env
    echo ""
    echo "📝 Please edit .env and add your API key:"
    echo "   - Set AUDIT_AGENT_AI_ENABLED=true"
    echo "   - Add your OPENAI_API_KEY or ANTHROPIC_API_KEY"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

# Check if AI is enabled
if [ "$AUDIT_AGENT_AI_ENABLED" != "true" ]; then
    echo "⚠️ AI is not enabled in .env"
    echo "Set AUDIT_AGENT_AI_ENABLED=true to test AI features"
    echo ""
    echo "Running standard analysis without AI..."
    npx hardhat auditagent
    exit 0
fi

# Check for API key
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ No API key found!"
    echo "Please add OPENAI_API_KEY or ANTHROPIC_API_KEY to your .env file"
    exit 1
fi

echo "✅ AI Configuration Found"
echo "   Provider: $AUDIT_AGENT_AI_PROVIDER"
echo "   Enabled: $AUDIT_AGENT_AI_ENABLED"
echo ""

echo "🔍 Test 1: Basic Analysis (No AI)"
echo "-----------------------------------"
npx hardhat auditagent --mode basic
echo ""
echo ""

echo "🤖 Test 2: AI-Enhanced Analysis"
echo "-----------------------------------"
npx hardhat auditagent --ai
echo ""
echo ""

echo "📋 Test 3: AI-Enhanced Playbook Analysis"
echo "-----------------------------------"
if [ -f "playbooks/ai-defi-security.yaml" ]; then
    npx hardhat auditagent --playbook playbooks/ai-defi-security.yaml --ai
else
    echo "⚠️ Playbook not found, skipping..."
fi
echo ""
echo ""

echo "✅ All tests complete!"
echo ""
echo "💡 Comparison:"
echo "   - Basic mode: Fast, pattern-based detection"
echo "   - AI mode: Detailed explanations + fix suggestions"
echo "   - Playbook mode: Custom AI prompts for specific contexts"

