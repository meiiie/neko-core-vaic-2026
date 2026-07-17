import type { AgentToolCall } from './loop';

/**
 * Parse the deliberately narrow JSON fallback used by providers that do not
 * support native tool calls. This lives outside provider implementations so a
 * browser-only provider cannot introduce a runtime provider-module cycle.
 */
export function parseJsonToolEnvelope(content: string | null): AgentToolCall | null {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { tool?: unknown; args?: unknown };
    if (typeof parsed.tool !== 'string') return null;
    const args =
      typeof parsed.args === 'object' && parsed.args !== null
        ? Object.fromEntries(
            Object.entries(parsed.args as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value),
            ]),
          )
        : {};
    return { name: parsed.tool, args };
  } catch {
    return null;
  }
}
