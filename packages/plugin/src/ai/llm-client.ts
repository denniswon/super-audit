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

/**
 * Type guard and interface for API errors that may contain response data
 */
interface APIErrorWithResponse extends Error {
  response?: unknown;
  responseText?: string;
}

function isAPIErrorWithResponse(error: unknown): error is APIErrorWithResponse {
  return (
    error instanceof Error &&
    typeof error === "object" &&
    ("response" in error || "responseText" in error)
  );
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

      // Use max_completion_tokens for all OpenAI models (required for newer models like o1, o3)
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
          max_completion_tokens: this.config.maxTokens || 1000,
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
      } catch (parseError) {
        console.warn(
          `⚠️ OpenAI response is not pure JSON (${parseError instanceof Error ? parseError.message : String(parseError)}), attempting to extract JSON from response...`,
        );
        // Try to extract JSON from markdown code blocks or other text
        const jsonMatch =
          responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
          responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const jsonToParse = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonToParse);
            response =
              typeof parsed === "object" && parsed !== null ? parsed : {};
          } catch (extractError) {
            console.error(
              `❌ OpenAI JSON extraction error: ${extractError instanceof Error ? extractError.message : String(extractError)}`,
            );
            console.error(`📄 Full API response (first 2000 chars):`);
            console.error(responseText.substring(0, 2000));
            console.error(`📄 Extracted JSON text (first 1000 chars):`);
            console.error((jsonMatch[1] || jsonMatch[0]).substring(0, 1000));
            // Fallback: create a basic response from the text
            response = {
              explanation: responseText,
              confidence: 0.5,
            };
          }
        } else {
          console.error(
            `❌ OpenAI response contains no valid JSON. Full response (first 2000 chars):`,
          );
          console.error(responseText.substring(0, 2000));
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
      console.error(`❌ OpenAI API error: ${errorMessage}`);

      // Print full error details if available
      if (error instanceof Error) {
        console.error(`📄 Error stack:`, error.stack);
      }

      // If error has response data, print it
      if (isAPIErrorWithResponse(error)) {
        try {
          const responseData = error.response;
          console.error(
            `📄 API Response data:`,
            JSON.stringify(responseData, null, 2),
          );
        } catch {
          console.error(`📄 API Response data (raw):`, error.response);
        }
      }

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
        let jsonText = responseText.trim();

        // First, try to find JSON in a code block with json language tag
        const jsonCodeBlockMatch = responseText.match(
          /```json\s*\n?([\s\S]*?)\n?```/i,
        );
        if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
          jsonText = jsonCodeBlockMatch[1].trim();
        } else {
          // Try generic code block
          const codeBlockMatch = responseText.match(
            /```\s*\n?([\s\S]*?)\n?```/,
          );
          if (codeBlockMatch && codeBlockMatch[1]) {
            const extracted = codeBlockMatch[1].trim();
            // Check if it looks like JSON (starts with { or [)
            if (extracted.startsWith("{") || extracted.startsWith("[")) {
              jsonText = extracted;
            }
          } else {
            // Try to extract JSON object directly (find first { ... } or [ ... ])
            const jsonObjectMatch = responseText.match(
              /(\{[\s\S]*\}|\[[\s\S]*\])/,
            );
            if (jsonObjectMatch && jsonObjectMatch[0]) {
              jsonText = jsonObjectMatch[0].trim();
            }
          }
        }

        // Debug: log what we're about to parse (only if it's different from original)
        if (jsonText !== responseText.trim()) {
          console.debug(`🔍 Extracted JSON from markdown code block`);
        }

        try {
          const parsed = JSON.parse(jsonText);
          const response: Record<string, unknown> =
            typeof parsed === "object" && parsed !== null ? parsed : {};
          return this.validateResponse(response);
        } catch (parseError) {
          // JSON parsing failed - likely due to unescaped backticks in code blocks
          // Try to extract and fix the JSON by handling code blocks inside strings
          try {
            // Find the JSON object boundaries by matching braces (accounting for strings)
            let braceCount = 0;
            let jsonStart = -1;
            let jsonEnd = -1;
            let inString = false;
            let escapeNext = false;

            for (let i = 0; i < jsonText.length; i++) {
              const char = jsonText[i];

              if (escapeNext) {
                escapeNext = false;
                continue;
              }

              if (char === "\\") {
                escapeNext = true;
                continue;
              }

              if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }

              if (!inString) {
                if (char === "{") {
                  if (braceCount === 0) jsonStart = i;
                  braceCount++;
                } else if (char === "}") {
                  braceCount--;
                  if (braceCount === 0) {
                    jsonEnd = i + 1;
                    break;
                  }
                }
              }
            }

            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              let extractedJson = jsonText.substring(jsonStart, jsonEnd);

              // Fix unescaped code blocks inside JSON strings
              // Pattern: "text\n```language\ncode\n```"
              // We need to escape the backticks and newlines properly
              extractedJson = extractedJson.replace(
                /("(?:[^"\\]|\\.)*?)\n```(\w+)?\n([\s\S]*?)\n```/g,
                (
                  match: string,
                  prefix: string,
                  lang: string | undefined,
                  code: string,
                ) => {
                  // Escape the code block content for JSON
                  const escapedCode = code
                    .replace(/\\/g, "\\\\")
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, "\\n")
                    .replace(/\r/g, "\\r")
                    .replace(/\t/g, "\\t");
                  return (
                    prefix +
                    "\\n```" +
                    (lang || "") +
                    "\\n" +
                    escapedCode +
                    '\\n```"'
                  );
                },
              );

              const parsed = JSON.parse(extractedJson);
              const response: Record<string, unknown> =
                typeof parsed === "object" && parsed !== null ? parsed : {};
              return this.validateResponse(response);
            }
          } catch (extractError) {
            // Extraction failed, log and fall through
            console.debug(
              `JSON extraction attempt failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`,
            );
          }

          console.error(
            `❌ Anthropic JSON parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
          console.error(`📄 Full API response (first 2000 chars):`);
          console.error(responseText.substring(0, 2000));
          if (responseText.length > 2000) {
            console.error(
              `... (truncated, total length: ${responseText.length} chars)`,
            );
          }
          console.error(
            `📄 Extracted JSON text that failed to parse (first 1000 chars):`,
          );
          console.error(jsonText.substring(0, 1000));
          if (jsonText.length > 1000) {
            console.error(
              `... (truncated, total length: ${jsonText.length} chars)`,
            );
          }
          // Final fallback: return basic response
          return this.getFallbackResponse();
        }
      }

      throw new Error("Invalid response from Anthropic");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Anthropic API error: ${errorMessage}`);

      // Print full error details if available
      if (error instanceof Error) {
        console.error(`📄 Error stack:`, error.stack);
      }

      // If error has response data, print it
      if (isAPIErrorWithResponse(error)) {
        try {
          const responseData = error.response;
          console.error(
            `📄 API Response data:`,
            JSON.stringify(responseData, null, 2),
          );
        } catch {
          console.error(`📄 API Response data (raw):`, error.response);
        }

        // If we have the responseText, print it
        if (error.responseText !== undefined) {
          console.error(
            `📄 API Response text (first 2000 chars):`,
            error.responseText.substring(0, 2000),
          );
        }
      }

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
