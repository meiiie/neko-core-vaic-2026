export interface AgentToolCall {
  readonly id?: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

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
      typeof parsed.args === 'object' && parsed.args !== null && !Array.isArray(parsed.args)
        ? (parsed.args as Record<string, unknown>)
        : {};
    return { name: parsed.tool, args };
  } catch {
    return null;
  }
}
