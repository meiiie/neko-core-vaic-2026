import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseQuestionVariants, toolByName } from './tools';

const VALID_VARIANT = {
  prompt: 'Tỉ số của 6 và 8 theo thứ tự đó là bao nhiêu?',
  choices: [
    { id: 'a', label: '6/8' },
    { id: 'b', label: '8/6', misconceptionTag: 'RATIO_ORDER_REVERSED' },
    { id: 'c', label: '6:14' },
  ],
  correctChoiceId: 'a',
  explanation: 'Tỉ số a:b giữ thứ tự đại lượng như câu hỏi.',
  reviewState: 'UNREVIEWED',
};

describe('parseQuestionVariants — LLM output guard', () => {
  it('accepts a well-formed variant and keeps it UNREVIEWED', () => {
    const result = parseQuestionVariants({ variants: [VALID_VARIANT] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.variants[0]!.reviewState).toBe('UNREVIEWED');
      expect(result.variants[0]!.choices.length).toBe(3);
    }
  });

  it('rejects when the proposed correct choice is not among the choices', () => {
    const result = parseQuestionVariants({
      variants: [{ ...VALID_VARIANT, correctChoiceId: 'zzz' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/correctChoiceId/);
  });

  it('rejects a distractor misconception tag outside the authored vocabulary', () => {
    const result = parseQuestionVariants({
      variants: [
        {
          ...VALID_VARIANT,
          choices: [
            { id: 'a', label: '6/8' },
            { id: 'b', label: 'x', misconceptionTag: 'INVENTED_TAG_BY_MODEL' },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/INVENTED_TAG_BY_MODEL/);
  });

  it('rejects prompt that is too short (schema floor)', () => {
    const result = parseQuestionVariants({
      variants: [{ ...VALID_VARIANT, prompt: 'ngắn' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when choice ids collide', () => {
    const result = parseQuestionVariants({
      variants: [
        {
          ...VALID_VARIANT,
          choices: [
            { id: 'a', label: '6/8' },
            { id: 'a', label: '8/6' },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/trùng id/);
  });

  it('ignores a misconception tag on the CORRECT choice (only distractors are constrained)', () => {
    const result = parseQuestionVariants({
      variants: [
        {
          ...VALID_VARIANT,
          choices: [
            { id: 'a', label: '6/8', misconceptionTag: 'NOT_CHECKED_ON_CORRECT' },
            { id: 'b', label: '8/6', misconceptionTag: 'RATIO_ORDER_REVERSED' },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('caps the number of variants at 3 (schema ceiling)', () => {
    const result = parseQuestionVariants({
      variants: [VALID_VARIANT, VALID_VARIANT, VALID_VARIANT, VALID_VARIANT],
    });
    expect(result.ok).toBe(false);
  });
});

describe('sinh_bien_the_bai_tap tool', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects a kc outside the authored graph before any network call', async () => {
    const tool = toolByName('sinh_bien_the_bai_tap')!;
    const result = await tool.run({ kc: 'K99' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/không thuộc đồ thị/);
  });

  it('returns UNREVIEWED drafts when the server provides a valid variant set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ variants: [VALID_VARIANT] }),
      })),
    );
    const tool = toolByName('sinh_bien_the_bai_tap')!;
    const result = await tool.run({ kc: 'K07' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { trangThai: string; soBienThe: number };
      expect(data.trangThai).toBe('UNREVIEWED');
      expect(data.soBienThe).toBe(1);
    }
  });

  it('refuses to fabricate questions when the server endpoint is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    const tool = toolByName('sinh_bien_the_bai_tap')!;
    const result = await tool.run({ kc: 'K02' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/thay vì bịa/);
  });

  it('rejects a server payload whose variants fail the grounding guard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          variants: [
            {
              ...VALID_VARIANT,
              choices: [
                { id: 'a', label: '6/8' },
                { id: 'b', label: 'wrong', misconceptionTag: 'HALLUCINATED' },
              ],
            },
          ],
        }),
      })),
    );
    const tool = toolByName('sinh_bien_the_bai_tap')!;
    const result = await tool.run({ kc: 'K02' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/HALLUCINATED/);
  });
});
