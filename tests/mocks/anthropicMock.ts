/**
 * Pure helpers for building fake Anthropic Messages API responses. Each
 * AI test file wires these into `getAnthropicClient` via `vi.mock` +
 * `vi.hoisted` directly (vi.mock factories must be hoisted per-file, so
 * the mock wiring itself can't live in a shared helper) — this module
 * only builds the response payloads, never makes a real network call.
 */

export function toolUseResponse(toolName: string, input: unknown) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'tool_use', id: 'toolu_test', name: toolName, input }],
    stop_reason: 'tool_use',
  };
}

export function textResponse(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
  };
}

export function malformedToolResponse(toolName: string) {
  // A tool_use block whose input doesn't match the expected shape at all.
  return toolUseResponse(toolName, { unexpected: 'shape', nested: { a: 1 } });
}
