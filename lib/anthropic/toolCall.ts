import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, AnthropicUnavailableError } from './client';
import { ANTHROPIC_MODEL, MAX_OUTPUT_TOKENS } from './constants';

export type ClaudeCallError = 'ai_unavailable' | 'rate_limited' | 'invalid_ai_output';

export interface ClaudeToolResult {
  toolInput: unknown | null;
  textReply: string | null;
}

/**
 * Shared helper for every /api/parse-* and /api/modify-* route: calls
 * Claude with a single forced-shape tool available, and returns either
 * the tool's raw (not-yet-validated) input or a plain-text reply (used
 * when the model legitimately declines to call the tool, e.g. unparseable
 * input). Zod validation of `toolInput` always happens in the caller —
 * this function only handles the Anthropic API call itself.
 */
export async function callClaudeWithTool(params: {
  systemPrompt: string;
  userMessage: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
}): Promise<ClaudeToolResult> {
  const client = getAnthropicClient();

  let response;
  try {
    response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
      tools: [
        {
          name: params.toolName,
          description: params.toolDescription,
          input_schema: params.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'auto' },
    });
  } catch (error) {
  console.error('Anthropic API call failed:', error);
  throw toClaudeCallError(error);
}

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === params.toolName,
  );
  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');

  return {
    toolInput: toolUseBlock ? toolUseBlock.input : null,
    textReply: textBlock ? textBlock.text : null,
  };
}

function toClaudeCallError(error: unknown): Error {
  if (error instanceof AnthropicUnavailableError) return error;
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new AnthropicUnavailableError('Anthropic authentication failed.');
    }
    if (error.status === 429) {
      return new ClaudeRateLimitError('Anthropic rate limit exceeded.');
    }
    return new AnthropicUnavailableError(`Anthropic API error: ${error.message}`);
  }
  return new AnthropicUnavailableError('Anthropic request failed.');
}

export class ClaudeRateLimitError extends Error {}
