import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface LLMConfig {
  provider: "openai" | "anthropic" | "local";
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMAnalysisRequest {
  codeSnippet: string;
  ruleDescription: string;
  context: {
    fileName: string;
    functionName: string;
    contractName: string;
    severity: string;
  };
  analysisType: "vulnerability" | "fix" | "explanation" | "risk-ranking";
}

export interface LLMAnalysisResponse {
  explanation: string;
  suggestedFix?: string;
  riskScore?: number;
  additionalContext?: string;
  confidence: number;
}

export class LLMClient {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;

    if (config.provider === "openai" && config.apiKey) {
      this.openai = new OpenAI({ apiKey: config.apiKey });
    } else if (config.provider === "anthropic" && config.apiKey) {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
    }
  }

  async analyzeCode(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    const prompt = this.buildPrompt(request);

    if (this.config.provider === "openai") {
      return await this.callOpenAI(prompt);
    } else if (this.config.provider === "anthropic") {
      return await this.callAnthropic(prompt);
    }

    throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
  }

  private buildPrompt(request: LLMAnalysisRequest): string {
    return `You are an expert smart contract security auditor analyzing Solidity code.

CONTEXT:
- Contract: ${request.context.contractName}
- Function: ${request.context.functionName}
- File: ${request.context.fileName}
- Severity: ${request.context.severity}

RULE:
${request.ruleDescription}

CODE SNIPPET:
\`\`\`solidity
${request.codeSnippet}
\`\`\`

TASK: ${this.getTaskPrompt(request.analysisType)}

Provide your analysis in the following JSON format:
{
  "explanation": "Detailed explanation of the issue",
  "suggestedFix": "Concrete code fix with example",
  "riskScore": 1-10,
  "additionalContext": "Additional security considerations",
  "confidence": 0.0-1.0
}`;
  }

  private getTaskPrompt(type: string): string {
    switch (type) {
      case "vulnerability":
        return "Analyze this code for the security vulnerability described in the rule. Explain the attack vector and potential impact.";
      case "fix":
        return "Provide a secure code fix that addresses the vulnerability. Include before/after examples.";
      case "explanation":
        return "Explain this security issue in educational terms. Help the developer understand WHY this is dangerous.";
      case "risk-ranking":
        return "Assess the risk level of this vulnerability considering the context. Rank from 1 (low) to 10 (critical).";
      default:
        return "Analyze this code for security issues.";
    }
  }

  private async callOpenAI(prompt: string): Promise<LLMAnalysisResponse> {
    if (!this.openai) throw new Error("OpenAI not initialized");

    try {
      // Default to latest GPT model (gpt-4o-mini recommended for cost-effectiveness)
      // Latest: gpt-4.1, gpt-4.1-mini (Apr 2025)
      // Current: gpt-4o, gpt-4o-mini (recommended)
      const model = this.config.model || "gpt-4o-mini";
      const baseParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
        {
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert Solidity security auditor. Always respond with valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: this.config.temperature || 0.3,
          max_tokens: this.config.maxTokens || 1000,
        };

      // Only add response_format for models that support JSON mode
      // Supported models (2025):
      // - gpt-5.1 (Nov 2025: gpt-5.1, gpt-5.1-codex-max, etc.)
      // - gpt-5 (Aug 2025: all versions)
      // - gpt-4.1 (Apr 2025: all versions)
      // - gpt-4o (all versions including gpt-4o, gpt-4o-mini, gpt-4o-2024-*, gpt-4o-2025-*, etc.)
      // - gpt-4-turbo (all versions including gpt-4-turbo, gpt-4-turbo-preview, gpt-4-turbo-2024-*, gpt-4-turbo-2025-*, etc.)
      // - gpt-4 (0613 and later versions, including 2025 versions)
      // - gpt-3.5-turbo (1106 and later versions, including 2025 versions)
      const supportsJsonMode =
        model.startsWith("gpt-5.1") ||
        model.startsWith("gpt-5") ||
        model.startsWith("gpt-4.1") ||
        model.startsWith("gpt-4o") ||
        model.startsWith("gpt-4-turbo") ||
        (model.startsWith("gpt-4") && /^gpt-4-\d{4}/.test(model)) ||
        (model.startsWith("gpt-3.5-turbo") &&
          /^gpt-3\.5-turbo-\d{4}/.test(model));

      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
        supportsJsonMode
          ? { ...baseParams, response_format: { type: "json_object" } }
          : baseParams;

      const completion =
        await this.openai.chat.completions.create(completionParams);

      const responseText = completion.choices[0].message.content || "{}";

      // Try to parse as JSON, if it fails, extract JSON from the response
      let response: Record<string, unknown>;
      try {
        const parsed = JSON.parse(responseText);
        response = typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch {
        // Try to extract JSON from markdown code blocks or other text
        const jsonMatch =
          responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
          responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            response =
              typeof parsed === "object" && parsed !== null ? parsed : {};
          } catch {
            // Fallback: create a basic response from the text
            response = {
              explanation: responseText,
              confidence: 0.5,
            };
          }
        } else {
          // Fallback: create a basic response from the text
          response = {
            explanation: responseText,
            confidence: 0.5,
          };
        }
      }

      return this.validateResponse(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`OpenAI API error: ${errorMessage}`);
      return this.getFallbackResponse();
    }
  }

  private async callAnthropic(prompt: string): Promise<LLMAnalysisResponse> {
    if (!this.anthropic) throw new Error("Anthropic not initialized");

    try {
      // Default to latest Claude model (2025)
      // Latest Anthropic models:
      // - claude-opus-4-1-20250805 (alias: claude-opus-4-1) - most capable
      // - claude-opus-4-20250514 (alias: claude-opus-4-0)
      // - claude-sonnet-4-20250514 (alias: claude-sonnet-4-0) - recommended
      // Older models (deprecated but still work):
      // - claude-3-5-sonnet-20241022 (deprecated Oct 2025)
      // - claude-3-opus-20240229 (deprecated Jan 2026)
      // Note: Claude models support JSON output natively when requested in prompts
      const model = this.config.model || "claude-sonnet-4-0";

      const message = await this.anthropic.messages.create({
        model,
        max_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.3,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === "text") {
        const responseText = content.text;

        // Try to extract JSON from markdown code blocks if present
        // Priority: ```json ... ``` > ``` ... ``` > { ... }
        let jsonText = responseText;
        const jsonCodeBlockMatch = responseText.match(
          /```json\n?([\s\S]*?)\n?```/,
        );
        if (jsonCodeBlockMatch) {
          jsonText = jsonCodeBlockMatch[1].trim();
        } else {
          const codeBlockMatch = responseText.match(/```\n?([\s\S]*?)\n?```/);
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1].trim();
          } else {
            // Try to extract JSON object directly
            const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
              jsonText = jsonObjectMatch[0];
            }
          }
        }

        try {
          const parsed = JSON.parse(jsonText);
          const response: Record<string, unknown> =
            typeof parsed === "object" && parsed !== null ? parsed : {};
          return this.validateResponse(response);
        } catch (parseError) {
          console.warn(
            `Anthropic JSON parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
          // If JSON parsing fails, try original text as fallback
          try {
            const parsed = JSON.parse(responseText);
            const response: Record<string, unknown> =
              typeof parsed === "object" && parsed !== null ? parsed : {};
            return this.validateResponse(response);
          } catch {
            // Final fallback: return basic response
            return this.getFallbackResponse();
          }
        }
      }

      throw new Error("Invalid response from Anthropic");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`Anthropic API error: ${errorMessage}`);
      return this.getFallbackResponse();
    }
  }

  private validateResponse(
    response: Record<string, unknown>,
  ): LLMAnalysisResponse {
    return {
      explanation:
        typeof response.explanation === "string"
          ? response.explanation
          : "No explanation provided",
      suggestedFix:
        typeof response.suggestedFix === "string"
          ? response.suggestedFix
          : undefined,
      riskScore:
        typeof response.riskScore === "number" ? response.riskScore : undefined,
      additionalContext:
        typeof response.additionalContext === "string"
          ? response.additionalContext
          : undefined,
      confidence:
        typeof response.confidence === "number" ? response.confidence : 0.5,
    };
  }

  private getFallbackResponse(): LLMAnalysisResponse {
    return {
      explanation:
        "AI analysis unavailable. Please check your API key and network connection.",
      confidence: 0.0,
    };
  }
}
