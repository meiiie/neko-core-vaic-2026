import type { AgentUsage } from './loop';

export interface GenerationMetrics {
  readonly ttftMs: number | null;
  readonly firstFlushMs: number | null;
  readonly totalMs: number;
  readonly streamMs: number | null;
  readonly outputTokens: number | null;
  readonly tpotMs: number | null;
  readonly tokensPerSecond: number | null;
  readonly interTokenLatencyMs: {
    readonly p50: number;
    readonly p99: number;
    readonly max: number;
  } | null;
}

export class GenerationTelemetry {
  private readonly startedAt: number;
  private firstDeltaAt: number | null = null;
  private lastDeltaAt: number | null = null;
  private firstFlushAt: number | null = null;
  private readonly deltaIntervals: number[] = [];

  constructor(private readonly now: () => number = () => performance.now()) {
    this.startedAt = now();
  }

  recordDelta(timestamp = this.now()): void {
    if (this.firstDeltaAt === null) this.firstDeltaAt = timestamp;
    if (this.lastDeltaAt !== null) this.deltaIntervals.push(timestamp - this.lastDeltaAt);
    this.lastDeltaAt = timestamp;
  }

  recordFlush(timestamp?: number): void {
    if (this.firstFlushAt === null) this.firstFlushAt = timestamp ?? this.now();
  }

  finish(usage?: AgentUsage, timestamp = this.now()): GenerationMetrics {
    const streamMs =
      this.firstDeltaAt === null || this.lastDeltaAt === null
        ? null
        : this.lastDeltaAt - this.firstDeltaAt;
    const outputTokens = usage && Number.isFinite(usage.outputTokens) ? usage.outputTokens : null;
    const generatedIntervals = outputTokens !== null && outputTokens >= 2 ? outputTokens - 1 : null;
    const tpotMs =
      streamMs !== null && generatedIntervals !== null ? streamMs / generatedIntervals : null;
    const tokensPerSecond = tpotMs !== null && tpotMs > 0 ? 1000 / tpotMs : null;
    const sortedIntervals = [...this.deltaIntervals].sort((left, right) => left - right);
    const p99Index = Math.min(
      sortedIntervals.length - 1,
      Math.ceil(sortedIntervals.length * 0.99) - 1,
    );

    return {
      ttftMs: this.firstDeltaAt === null ? null : this.firstDeltaAt - this.startedAt,
      firstFlushMs: this.firstFlushAt === null ? null : this.firstFlushAt - this.startedAt,
      totalMs: timestamp - this.startedAt,
      streamMs,
      outputTokens,
      tpotMs,
      tokensPerSecond,
      interTokenLatencyMs:
        sortedIntervals.length === 0
          ? null
          : {
              p50: sortedIntervals[Math.floor(sortedIntervals.length / 2)],
              p99: sortedIntervals[p99Index],
              max: sortedIntervals.at(-1) ?? 0,
            },
    };
  }
}
