import { describe, expect, it } from 'vitest';

import { GenerationTelemetry } from './generation-telemetry';

function sequenceClock(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

describe('GenerationTelemetry', () => {
  it('records first-delta/flush once and computes honest stream metrics', () => {
    const telemetry = new GenerationTelemetry(sequenceClock([0, 120, 150, 180, 210, 300]));

    telemetry.recordDelta();
    telemetry.recordFlush();
    telemetry.recordFlush();
    telemetry.recordDelta();
    telemetry.recordDelta();

    expect(telemetry.finish({ inputTokens: 10, outputTokens: 7 })).toEqual({
      ttftMs: 120,
      firstFlushMs: 150,
      totalMs: 300,
      streamMs: 90,
      outputTokens: 7,
      tpotMs: 15,
      tokensPerSecond: 66.66666666666667,
      interTokenLatencyMs: { p50: 60, p99: 60, max: 60 },
    });
  });

  it('keeps first delta idempotent and reports no distribution for one delta', () => {
    const telemetry = new GenerationTelemetry(sequenceClock([10, 50, 80, 120]));
    telemetry.recordDelta();
    telemetry.recordFlush();

    expect(telemetry.finish()).toEqual({
      ttftMs: 40,
      firstFlushMs: 70,
      totalMs: 110,
      streamMs: 0,
      outputTokens: null,
      tpotMs: null,
      tokensPerSecond: null,
      interTokenLatencyMs: null,
    });
  });

  it('uses upper median and nearest-rank p99 for delta intervals', () => {
    const telemetry = new GenerationTelemetry(sequenceClock([0, 10, 15, 35, 36, 100]));
    telemetry.recordDelta();
    telemetry.recordDelta();
    telemetry.recordDelta();
    telemetry.recordDelta();

    expect(telemetry.finish({ inputTokens: 1, outputTokens: 1 })).toMatchObject({
      interTokenLatencyMs: { p50: 5, p99: 20, max: 20 },
      tpotMs: null,
      tokensPerSecond: null,
    });
  });
});
