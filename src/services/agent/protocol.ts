export interface AgentToolCall {
  readonly id?: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

const MAX_ENVELOPE_SOURCE_LENGTH = 64_000;
const MAX_ENVELOPE_LENGTH = 16_000;

function objectEnd(source: string, start: number): number | null {
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    if (index - start >= MAX_ENVELOPE_LENGTH) return null;
  }
  return null;
}

/**
 * Parse the deliberately narrow JSON fallback used by providers that do not
 * support native tool calls. This lives outside provider implementations so a
 * browser-only provider cannot introduce a runtime provider-module cycle.
 */
export function parseJsonToolEnvelope(content: string | null): AgentToolCall | null {
  if (!content) return null;
  const source = content.slice(0, MAX_ENVELOPE_SOURCE_LENGTH);
  for (let start = source.indexOf('{'); start >= 0; start = source.indexOf('{', start + 1)) {
    const end = objectEnd(source, start);
    if (end === null) continue;
    try {
      const parsed = JSON.parse(source.slice(start, end)) as { tool?: unknown; args?: unknown };
      if (typeof parsed.tool !== 'string' || parsed.tool.length === 0) continue;
      const args =
        typeof parsed.args === 'object' && parsed.args !== null && !Array.isArray(parsed.args)
          ? (parsed.args as Record<string, unknown>)
          : {};
      return { name: parsed.tool, args };
    } catch {
      // A provider may wrap a valid envelope in prose or emit an invalid object first.
    }
  }
  return null;
}
