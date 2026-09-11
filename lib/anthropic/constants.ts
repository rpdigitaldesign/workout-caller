/**
 * The ONE place the Claude model id lives. Every module under
 * lib/anthropic/ imports from here — changing models later is a
 * one-line edit.
 *
 * claude-haiku-4-5 is a current, fast, inexpensive model well-suited to
 * structured short-to-medium JSON extraction (workout text -> schema,
 * single-workout modification, short command parsing). None of these
 * tasks need multi-step reasoning, so a more expensive extended-thinking
 * model would be unnecessary cost for no benefit here.
 */
export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export const MAX_OUTPUT_TOKENS = 4096;
export const REQUEST_TIMEOUT_MS = 30_000;
