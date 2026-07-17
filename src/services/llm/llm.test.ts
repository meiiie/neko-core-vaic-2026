import { describe, expect, it } from 'vitest';
import { runGuards } from './guards';
import { MockTutorLlm } from './mock';
import { OpenAiCompatTutorLlm } from './openai-compat';
import type { TutorLlmRequest } from './port';

function makeRequest(overrides: Partial<TutorLlmRequest> = {}): TutorLlmRequest {
  return {
    requestId: 'req-1',
    useCase: 'EXPLAIN_DIAGNOSIS',
    locale: 'vi-VN',
    facts: { status: 'DIAGNOSED', rootKcName: 'Phân số bằng nhau' },
    allowedCitationIds: ['evt-1', 'evt-2'],
    forbiddenStrings: ['x = 9'],
    fallbackText: 'Fallback đã duyệt.',
    ...overrides,
  };
}

describe('LLM guard pipeline', () => {
  it('rejects replies that fail the schema', () => {
    expect(runGuards({ nope: true }, makeRequest())).toEqual({
      ok: false,
      reason: 'SCHEMA_INVALID',
    });
  });

  it('rejects citations outside the allowed set', () => {
    const verdict = runGuards({ text: 'Ổn.', citedIds: ['evt-999'] }, makeRequest());
    expect(verdict).toEqual({ ok: false, reason: 'CITATION_VIOLATION' });
  });

  it('rejects answer leakage regardless of case/whitespace', () => {
    const verdict = runGuards({ text: 'Đáp án là X  =  9 nhé!', citedIds: [] }, makeRequest());
    expect(verdict).toEqual({ ok: false, reason: 'ANSWER_LEAKAGE' });
  });

  it('rejects text contradicting the diagnosed root', () => {
    const verdict = runGuards(
      { text: 'Em đã vững phân số bằng nhau rồi.', citedIds: [] },
      makeRequest(),
    );
    expect(verdict).toEqual({ ok: false, reason: 'CONSISTENCY_VIOLATION' });
  });

  it('accepts a clean reply', () => {
    const verdict = runGuards({ text: 'Cùng luyện thêm nhé.', citedIds: ['evt-1'] }, makeRequest());
    expect(verdict.ok).toBe(true);
  });
});

describe('Mock adapter (L1 active profile)', () => {
  it('is deterministic and passes its own guards', async () => {
    const port = new MockTutorLlm();
    const first = await port.complete(makeRequest());
    const second = await port.complete(makeRequest());
    expect(first.status).toBe('OK');
    expect(first.text).toBe(second.text);
    expect(first.text).toContain('Phân số bằng nhau');
  });

  it('abstains gracefully for NEEDS_MORE_EVIDENCE facts', async () => {
    const port = new MockTutorLlm();
    const reply = await port.complete(makeRequest({ facts: { status: 'NEEDS_MORE_EVIDENCE' } }));
    expect(reply.status).toBe('OK');
    expect(reply.text).toContain('chưa đủ bằng chứng');
  });
});

describe('OpenAI-compat adapter resilience', () => {
  it('falls back with HTTP_ERROR on a non-retryable status', async () => {
    const port = new OpenAiCompatTutorLlm(
      { profileId: 'test', baseUrl: 'http://example.invalid/v1', model: 'm' },
      async () => new Response('{}', { status: 400 }),
    );
    const reply = await port.complete(makeRequest());
    expect(reply.status).toBe('FALLBACK');
    expect(reply.text).toBe('Fallback đã duyệt.');
    expect(reply.meta.fallbackReason).toBe('HTTP_ERROR');
  });

  it('guards a well-formed but leaking model reply into fallback', async () => {
    const body = {
      choices: [
        { message: { content: JSON.stringify({ text: 'Kết quả là x = 9.', citedIds: [] }) } },
      ],
    };
    const port = new OpenAiCompatTutorLlm(
      { profileId: 'test', baseUrl: 'http://example.invalid/v1', model: 'm' },
      async () => new Response(JSON.stringify(body), { status: 200 }),
    );
    const reply = await port.complete(makeRequest());
    expect(reply.status).toBe('FALLBACK');
    expect(reply.meta.fallbackReason).toBe('ANSWER_LEAKAGE');
  });
});
