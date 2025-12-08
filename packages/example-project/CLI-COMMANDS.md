# MrklTree CLI Commands - Example Usage

This document demonstrates all available CLI commands in the MrklTree plugin from the example project.

## Prerequisites

Make sure you have:

- Installed dependencies: `pnpm install`
- Built the plugin: `cd packages/plugin && pnpm build`
- Set up `.env` file with API keys (already configured)

## Basic Commands

### 1. Run Analysis with Default Playbook

```bash
npx hardhat auditagent
```

Uses the playbook configured in `hardhat.config.ts` (currently `./playbooks/erc20-token-security.yaml`)

### 2. Run Analysis with Different Playbook

```bash
npx hardhat auditagent --playbook ./playbooks/complete-defi-security.yaml
```

### 3. Run Analysis with AI DeFi Playbook

```bash
npx hardhat auditagent --playbook ./playbooks/ai-defi-security.yaml
```

### 4. Run Analysis in Different Modes

```bash
# Basic mode (fastest, AST rules only)
npx hardhat auditagent --mode basic

# Advanced mode (AST + CFG analysis)
npx hardhat auditagent --mode advanced

# Full mode (all rules + playbooks)
npx hardhat auditagent --mode full
```

### 5. Different Output Formats

```bash
# Console output (default, colored)
npx hardhat auditagent --format console

# JSON output (machine-readable)
npx hardhat auditagent --format json

# SARIF format (GitHub Code Scanning)
npx hardhat auditagent --format sarif
```

### 6. Save Output to File

```bash
# Save console report
npx hardhat auditagent --output ./audit-report.txt

# Save JSON report
npx hardhat auditagent --format json --output ./audit-results.json

# Save SARIF report
npx hardhat auditagent --format sarif --output ./auditagent.sarif
```

### 7. Run Specific Rules Only

```bash
npx hardhat auditagent --rules no-tx-origin,reentrancy-paths,explicit-visibility
```

### 8. Enable/Disable AI Enhancement

```bash
# Enable AI (if not already enabled in config)
npx hardhat auditagent --ai

# Disable AI (override config)
AUDIT_AGENT_AI_ENABLED=false npx hardhat auditagent
```

## Advanced Usage

### Combining Multiple Options

```bash
# Full analysis with specific playbook, JSON output, and AI
npx hardhat auditagent \
  --mode full \
  --playbook ./playbooks/complete-defi-security.yaml \
  --format json \
  --output ./reports/full-audit.json \
  --ai
```

### Using Different AI Models

```bash
# Use GPT-4 (slower, more thorough)
AUDIT_AGENT_AI_MODEL=gpt-4 npx hardhat auditagent

# Use GPT-3.5-turbo (faster, cheaper - already configured)
AUDIT_AGENT_AI_MODEL=gpt-3.5-turbo npx hardhat auditagent
```

### Quick CI/CD Check

```bash
# Fast check without AI for CI
npx hardhat auditagent --mode basic --format json --output ./ci-report.json
```

## Playbook Registry Commands (Coming Soon)

The following commands will be available once the registry integration is fully connected:

```bash
# List all registered playbooks
npx hardhat auditagent --list-playbooks

# Show registry statistics
npx hardhat auditagent --registry-stats

# Register a new playbook
npx hardhat auditagent --register-playbook ./my-custom-playbook.yaml

# Upload playbook to Lighthouse/IPFS
npx hardhat auditagent --upload-playbook ./playbooks/erc20-token-security.yaml

# Register from Lighthouse CID
npx hardhat auditagent --register-from-lighthouse bafkreih...

# Sync all playbooks from Lighthouse
npx hardhat auditagent --sync-lighthouse

# Search playbooks by tags
npx hardhat auditagent --search-playbooks defi,vault,security

# Auto-recommend playbooks based on contracts
npx hardhat auditagent --auto-recommend
```

## Test Scripts

### Run All Tests

```bash
./test-cli.sh
```

### Run Lighthouse Integration Demo

```bash
cd ../plugin
node --import tsx/esm src/playbooks/lighthouse-example.ts
```

This will demonstrate:

- ✅ Uploading playbooks to IPFS
- ✅ Getting CID and gateway URL
- ✅ Downloading from Lighthouse
- ✅ Registering playbooks in registry
- ✅ Syncing from Lighthouse account

## Output Files Generated

After running various commands, you'll see:

- `audit-report.txt` - Console format report
- `audit-results.json` - JSON format report
- `auditagent.sarif` - SARIF format for GitHub

## Performance Metrics

- **Basic mode**: ~2-5ms per contract
- **Advanced mode**: ~10-15ms per contract
- **Full mode with AI**: ~2-3 seconds per issue (with GPT-3.5-turbo)
- **Full mode with AI**: ~5-10 seconds per issue (with GPT-4)

## Cost Estimates (AI Enhancement)

When using AI enhancement with OpenAI:

- **GPT-3.5-turbo**: ~$0.002 per issue analyzed
- **GPT-4**: ~$0.01-0.03 per issue analyzed

For a typical project with 20-30 issues:

- **GPT-3.5-turbo**: ~$0.05-0.10 per full audit
- **GPT-4**: ~$0.20-0.90 per full audit

## Troubleshooting

### If analysis fails:

1. Make sure contracts are in `./contracts` directory
2. Check that playbook file exists and is valid YAML
3. Verify .env file has API keys (if using AI)
4. Rebuild plugin: `cd ../plugin && pnpm build`

### If AI enhancement fails:

1. Check OPENAI_API_KEY in .env file
2. Verify API key is valid and has credits
3. Try with `--mode basic` first to isolate the issue

### If playbook fails to load:

1. Validate YAML syntax
2. Check rule DSL patterns are valid
3. Ensure file path is correct (relative to project root)

## Examples from This Project

The `contracts/` directory contains sample contracts with various security issues:

- **Counter.sol** - Basic patterns
- **ExampleToken.sol** - ERC20 implementation with issues
- **TestViolations.sol** - Multiple rule violations (for testing)
- **VulnerableVault.sol** - DeFi vault with vulnerabilities

Run analysis to see how MrklTree detects these issues!

## Next Steps

1. ✅ Basic analysis is working
2. ✅ Playbook system is integrated
3. ✅ AI enhancement is operational
4. ✅ Lighthouse storage is implemented
5. ⏳ Wire up registry CLI commands to the main task
6. ⏳ Test complete workflow end-to-end
