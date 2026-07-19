import { describe, expect, it } from 'vitest';
import { validateVariantSet } from './variants.ts';

const goodVariant = {
  prompt: 'Tỉ số của 6 và 8 theo thứ tự đó là bao nhiêu?',
  choices: [
    { id: 'a', label: '6/8' },
    { id: 'b', label: '8/6', misconceptionTag: 'RATIO_ORDER_REVERSED' },
  ],
  correctChoiceId: 'a',
  explanation: 'Tỉ số giữ thứ tự đại lượng.',
  reviewState: 'UNREVIEWED',
};

describe('validateVariantSet — server grounding mirror', () => {
  it('accepts a well-formed variant set', () => {
    const result = validateVariantSet({ variants: [goodVariant] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.variants[0]?.correctChoiceId).toBe('a');
  });

  it('hardcodes UNREVIEWED even when the model claims otherwise', () => {
    const result = validateVariantSet({
      variants: [{ ...goodVariant, reviewState: 'ACCEPTED' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.variants[0]?.reviewState).toBe('UNREVIEWED');
  });

  it('rejects a correctChoiceId that is not among the choices', () => {
    const result = validateVariantSet({
      variants: [{ ...goodVariant, correctChoiceId: 'z' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('LLM_CORRECT_CHOICE_MISMATCH');
  });

  it('rejects a hallucinated misconception tag outside the authored catalog', () => {
    const result = validateVariantSet({
      variants: [
        {
          ...goodVariant,
          choices: [
            { id: 'a', label: '6/8' },
            { id: 'b', label: '8/6', misconceptionTag: 'MADE_UP_TAG' },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('LLM_UNKNOWN_MISCONCEPTION');
  });

  it('rejects colliding choice ids', () => {
    const result = validateVariantSet({
      variants: [
        {
          ...goodVariant,
          choices: [
            { id: 'a', label: '6/8' },
            { id: 'a', label: '8/6' },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('LLM_CHOICE_ID_COLLISION');
  });

  it('rejects schema violations such as a too-short prompt', () => {
    const result = validateVariantSet({
      variants: [{ ...goodVariant, prompt: 'Ngắn' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('LLM_SCHEMA');
  });
});
