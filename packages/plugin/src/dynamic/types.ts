// Types for dynamic analysis and fuzzing engine

/**
 * Types for dynamic analysis and fuzzing engine
 */

export interface ForkEnvironment {
  network: string;
  blockNumber?: number;
  rpcUrl?: string;
  accounts: string[];
  provider: unknown; // Web3Provider or similar
}

export interface FuzzingConfig {
  runs: number;
  depth: number;
  strategy: "random" | "coverage" | "mutation";
  timeout: number;
  seed?: number;
}

export interface FuzzingResults {
  totalRuns: number;
  failedRuns: number;
  coverage: CoverageInfo;
  violations: FuzzingViolation[];
  exploits: ExploitResult[];
  executionTime: number;
}

export interface CoverageInfo {
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  coveragePercentage: number;
  uncoveredLines: number[];
}

export interface FuzzingViolation {
  type: "revert" | "invariant" | "assertion" | "gas" | "panic";
  function: string;
  input: unknown;
  trace: ExecutionTrace;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface ExploitResult {
  name: string;
  success: boolean;
  profitAmount: string;
  attackSequence: AttackStep[];
  minimizedSequence: AttackStep[];
  gasUsed: number;
  description: string;
}

export interface AttackStep {
  contract: string;
  method: string;
  params: unknown[];
  value?: string;
  gasUsed?: number;
  result?: unknown;
  events?: Event[];
}

export interface ExecutionTrace {
  steps: TraceStep[];
  gasUsed: number;
  success: boolean;
  returnValue?: unknown;
  revertReason?: string;
}

export interface TraceStep {
  depth: number;
  opcode: string;
  gas: number;
  gasCost: number;
  stack: string[];
  memory?: string;
  storage?: Record<string, string>;
}

export interface ReentrancyTestResult {
  isVulnerable: boolean;
  exploitPath: AttackStep[];
  profitAmount: string;
  victimContract: string;
  attackContract: string;
  description: string;
}

export interface InvariantResult {
  name: string;
  expression: string;
  passed: boolean;
  failingInput?: unknown;
  actualValue?: unknown;
  expectedCondition: string;
}

export interface EconomicShockResult {
  scenario: string;
  success: boolean;
  priceChange: string;
  liquidationsTriggered: number;
  fundsLost: string;
  description: string;
}

/**
 * Attack simulation framework types
 */
export interface AttackSimulation {
  name: string;
  target: string;
  type: "reentrancy" | "oracle" | "flashloan" | "governance" | "access";
  setup: AttackSetup;
  execution: AttackExecution;
  validation: AttackValidation;
}

export interface AttackSetup {
  deployAttacker: boolean;
  attackerCode?: string;
  initialBalance: string;
  requiredTokens?: string[];
  forkBlock?: number;
}

export interface AttackExecution {
  steps: AttackStep[];
  maxGasPerStep: number;
  expectedBehavior: "profit" | "revert" | "state_change";
}

export interface AttackValidation {
  profitThreshold?: string;
  invariants: string[];
  assertions: string[];
}

/**
 * Hardhat Network integration types
 */
export interface NetworkManager {
  forkMainnet(blockNumber?: number): Promise<ForkEnvironment>;
  forkTestnet(network: string, blockNumber?: number): Promise<ForkEnvironment>;
  resetFork(): Promise<void>;
  setBalance(address: string, balance: string): Promise<void>;
  setStorageAt(address: string, slot: string, value: string): Promise<void>;
  mine(blocks?: number): Promise<void>;
  setNextBlockTimestamp(timestamp: number): Promise<void>;
}

/**
 * Contract deployment and interaction types
 */
export interface ABIItem {
  type: string;
  name?: string;
  stateMutability?: string;
  inputs?: Array<{ type: string; name?: string }>;
  outputs?: Array<{ type: string; name?: string }>;
}

export interface DeployedContract {
  name: string;
  address: string;
  abi: ABIItem[];
  bytecode: string;
  deployer: string;
  constructorArgs: unknown[];
}

export interface ContractInteraction {
  contract: DeployedContract;
  method: string;
  params: unknown[];
  value?: string;
  gasLimit?: number;
  from?: string;
}

export interface InteractionResult {
  success: boolean;
  returnValue?: unknown;
  gasUsed: number;
  events: Event[];
  trace?: ExecutionTrace;
  error?: string;
}

/**
 * Fuzzing strategies and input generation
 */
export interface FuzzingStrategy {
  name: string;
  generateInput(
    functionAbi: Record<string, unknown>,
    previousInputs: unknown[],
  ): unknown[];
  mutateInput(input: unknown[], coverage: CoverageInfo): unknown[];
  shouldContinue(results: FuzzingResults): boolean;
}

export interface InputGenerator {
  generateAddress(): string;
  generateUint256(min?: string, max?: string): string;
  generateBytes(length?: number): string;
  generateBool(): boolean;
  generateArray<T>(generator: () => T, maxLength?: number): T[];
}
