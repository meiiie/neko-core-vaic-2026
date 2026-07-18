export interface AgentToolCall {
  readonly id?: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

const MAX_ENVELOPE_SOURCE_LENGTH = 64_000;
const MAX_ENVELOPE_LENGTH = 16_000;
const MAX_ENVELOPE_PARSE_BYTES = 256_000;

function objectRanges(source: string): Array<{ start: number; end: number }> {
  const starts: number[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (starts.length === 0) {
      if (character === '{') starts.push(index);
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') starts.push(index);
    else if (character === '}') {
      const start = starts.pop();
      if (start !== undefined && index + 1 - start <= MAX_ENVELOPE_LENGTH) {
        ranges.push({ start, end: index + 1 });
      }
    }
  }
  return ranges.sort((left, right) => left.start - right.start);
}

/**
 * Parse the deliberately narrow JSON fallback used by providers that do not
 * support native tool calls. This lives outside provider implementations so a
 * browser-only provider cannot introduce a runtime provider-module cycle.
 */
export function parseJsonToolEnvelope(content: string | null): AgentToolCall | null {
  if (!content) return null;
  const source = content.slice(0, MAX_ENVELOPE_SOURCE_LENGTH);
  let parsedBytes = 0;
  for (const { start, end } of objectRanges(source)) {
    const candidateLength = end - start;
    if (parsedBytes + candidateLength > MAX_ENVELOPE_PARSE_BYTES) continue;
    parsedBytes += candidateLength;
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
