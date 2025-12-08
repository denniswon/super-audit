import { HardhatUserConfig } from "hardhat/config";
import MrklAgentPlugin from "@mrkltree/auditagent";

export default {
  plugins: [MrklAgentPlugin],
  solidity: "0.8.29",

  // MrklTree configuration (optional - can also use CLI flags)
  auditagent: {
    mode: "full", // Options: "basic", "advanced", "full"
    format: "console", // Options: "console", "json", "sarif"
    // output: "./audit-report.txt",  // Optional: save report to file
    playbook: "./playbooks/erc20-token-security.yaml", // ERC20 token security audit
    // Alternative playbooks:
    // playbook: "./vault-security.yaml",  // For vault contracts
    // playbook: "./playbooks/ai-defi-security.yaml",  // AI-enhanced DeFi audit
    // rules: ["no-tx-origin", "reentrancy-paths"],  // Optional: specific rules
    // ai: {
    //   enabled: true,
    //   provider: "openai",  // Options: "openai", "anthropic", "local"
    //   model: "gpt-4",
    //   temperature: 0.3,
    //   maxTokens: 1000
    // }
  },
} satisfies HardhatUserConfig;
