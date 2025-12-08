import parser from "@solidity-parser/parser";
import { LLMClient, LLMAnalysisRequest } from "../ai/llm-client.js";
import type { Rule, AnalysisContext, Issue, ASTNode } from "../types.js";

/**
 * Extended Issue type with AI enhancement metadata
 */
interface IssueWithAIEnhancement extends Issue {
  _needsAIEnhancement?: boolean;
  _aiContext?: AnalysisContext;
}

export class AIEnhancedRule implements Rule {
  public readonly id: string;
  public readonly description: string;
  public readonly severity: "error" | "warning" | "info";

  private baseRule: Rule;
  private llmClient: LLMClient;
  private enableAI: boolean;

  constructor(baseRule: Rule, llmClient: LLMClient, enableAI: boolean = true) {
    this.id = `${baseRule.id}-ai`;
    this.description = `${baseRule.description} (AI-Enhanced)`;
    this.severity = baseRule.severity;
    this.baseRule = baseRule;
    this.llmClient = llmClient;
    this.enableAI = enableAI;
  }

  apply(ast: ASTNode, context: AnalysisContext): void {
    // Run base rule first (synchronously)
    this.baseRule.apply(ast, context);

    if (!this.enableAI) return;

    // Store original issues for async enhancement
    const originalIssues = [...context.issues].filter(
      (issue) => issue.ruleId === this.baseRule.id,
    );

    // Enhancement happens asynchronously - we'll mark issues for later enhancement
    originalIssues.forEach((issue) => {
      const issueWithAI = issue as IssueWithAIEnhancement;
      issueWithAI._needsAIEnhancement = true;
      issueWithAI._aiContext = context;
    });
  }

  async enhanceIssues(
    issues: Issue[],
    contexts: Map<Issue, AnalysisContext>,
  ): Promise<Issue[]> {
    const enhanced: Issue[] = [];

    // Define security-critical rules that benefit from AI enhancement
    const securityRules = new Set([
      "no-tx-origin",
      "reentrancy-paths",
      "external-before-state",
      "unreachable-code",
      "reentrancy-paths-analysis",
      "reentrancy-paths-mitigation",
    ]);

    for (const issue of issues) {
      // Only enhance security-critical issues, skip style/naming issues
      const issueWithAI = issue as IssueWithAIEnhancement;
      const shouldEnhance =
        issueWithAI._needsAIEnhancement && securityRules.has(issue.ruleId);

      if (shouldEnhance) {
        const context = contexts.get(issue) || issueWithAI._aiContext;
        if (context) {
          try {
            const enhancedIssue = await this.enhanceIssueWithAI(issue, context);
            enhanced.push(enhancedIssue);
          } catch (error) {
            console.warn(`AI enhancement failed for ${issue.ruleId}: ${error}`);
            enhanced.push(issue);
          }
        } else {
          enhanced.push(issue);
        }
      } else {
        enhanced.push(issue);
      }
    }

    return enhanced;
  }

  private async enhanceIssueWithAI(
    issue: Issue,
    context: AnalysisContext,
  ): Promise<Issue> {
    try {
      // Extract code snippet around the issue
      const codeSnippet = this.extractCodeSnippet(
        context.sourceCode,
        issue.line,
        10,
      );

      // Extract context information
      const functionName = this.extractFunctionName(
        context.sourceCode,
        issue.line,
      );
      const contractName = this.extractContractName(context.sourceCode);

      // Build LLM request
      const request: LLMAnalysisRequest = {
        codeSnippet,
        ruleDescription: this.description,
        context: {
          fileName: issue.file,
          functionName,
          contractName,
          severity: issue.severity,
        },
        analysisType: "vulnerability",
      };

      // Get AI analysis
      console.log(`🤖 Enhancing issue with AI: ${issue.ruleId}`);
      const aiResponse = await this.llmClient.analyzeCode(request);

      // Enhance the issue
      return {
        ...issue,
        message: this.formatEnhancedMessage(issue.message, aiResponse),
        aiEnhancement: {
          explanation: aiResponse.explanation,
          suggestedFix: aiResponse.suggestedFix,
          riskScore: aiResponse.riskScore,
          confidence: aiResponse.confidence,
        },
      };
    } catch (error) {
      console.warn(`AI enhancement failed for ${issue.ruleId}: ${error}`);
      return issue; // Return original issue if AI fails
    }
  }

  private formatEnhancedMessage(
    originalMessage: string,
    aiResponse: {
      explanation: string;
      suggestedFix?: string;
      additionalContext?: string;
      riskScore?: number;
      confidence?: number;
    },
  ): string {
    let enhanced = originalMessage;

    enhanced += `\n\n🤖 AI ANALYSIS:\n${aiResponse.explanation}`;

    if (aiResponse.suggestedFix) {
      enhanced += `\n\n🔧 SUGGESTED FIX:\n${aiResponse.suggestedFix}`;
    }

    if (aiResponse.additionalContext) {
      enhanced += `\n\n📚 ADDITIONAL CONTEXT:\n${aiResponse.additionalContext}`;
    }

    if (aiResponse.riskScore) {
      enhanced += `\n\n⚠️ RISK SCORE: ${aiResponse.riskScore}/10`;
    }

    if (aiResponse.confidence) {
      enhanced += `\n🎯 CONFIDENCE: ${(aiResponse.confidence * 100).toFixed(0)}%`;
    }

    return enhanced;
  }

  private extractCodeSnippet(
    source: string,
    line: number,
    contextLines: number,
  ): string {
    const lines = source.split("\n");
    const start = Math.max(0, line - contextLines);
    const end = Math.min(lines.length, line + contextLines);

    return lines.slice(start, end).join("\n");
  }

  private extractFunctionName(source: string, line: number): string {
    try {
      const ast = parser.parse(source, { loc: true, range: true });
      let foundFunction = "unknown";

      parser.visit(ast, {
        FunctionDefinition: (node: any) => {
          if (
            node.loc &&
            node.loc.start.line <= line &&
            node.loc.end.line >= line
          ) {
            foundFunction = node.name || "constructor";
          }
        },
      });

      return foundFunction;
    } catch (error) {
      return "unknown";
    }
  }

  private extractContractName(source: string): string {
    try {
      const ast = parser.parse(source, { loc: true });
      let contractName = "unknown";

      parser.visit(ast, {
        ContractDefinition: (node: { name?: string }) => {
          if (node.name) {
            contractName = node.name;
          }
        },
      });

      return contractName;
    } catch (error) {
      return "unknown";
    }
  }
}
