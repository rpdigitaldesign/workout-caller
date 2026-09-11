import Anthropic from '@anthropic-ai/sdk';
import { REQUEST_TIMEOUT_MS } from './constants';

/**
 * Server-only Anthropic client. This module (and everything that imports
 * it) must never be imported from a Client Component — importing
 * "server-only" makes that a build-time error instead of a silent key
 * leak.
 */
import 'server-only';

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicUnavailableError('ANTHROPIC_API_KEY is not configured.');
  }
  cachedClient = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return cachedClient;
}

export class AnthropicUnavailableError extends Error {}
