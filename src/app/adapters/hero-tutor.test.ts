import { describe, expect, it } from 'vitest';
import { learnerEventSchema } from '../../storage/event-repository';
import {
  buildHeroClassDashboard,
  buildLocalAnswerRecord,
  diagnoseHero,
  isHeroLearnerId,
  toDomainEvents,
} from './hero-tutor';

describe('hero-tutor adapter (UI integration over domain runtime)', () => {
  it('reproduces the four hero outcomes through the adapter', () => {
    const an = diagnoseHero('an');
    expect(an.status).toBe('DIAGNOSED');
    expect(an.rootKcId).toBe('K02');

    const binh = diagnoseHero('binh');
    expect(binh.status).toBe('DIAGNOSED');
    expect(binh.rootKcId).toBe('K07');

    const chi = diagnoseHero('chi');
    expect(chi.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(chi.rootKcId).toBeUndefined();

    const minh = diagnoseHero('minh');
    expect(minh.status).toBe('FAST_PATH');
  });

  it('builds schema-valid local answer records with continuing sequence numbers', () => {
    const record = buildLocalAnswerRecord('chi', 'K02-DIAGNOSTIC', 'a', true, 0);
    expect(() => learnerEventSchema.parse(record)).not.toThrow();
    // Chi has 7 seeded events (sequence 1..7); the first local answer continues after them.
    expect(record.sequence).toBe(8);

    const [event] = toDomainEvents([record]);
    expect(event).toMatchObject({ learnerId: 'chi', itemId: 'K02-DIAGNOSTIC', correct: true });
  });

  it('skips malformed local payloads instead of guessing', () => {
    const broken = { ...buildLocalAnswerRecord('chi', 'K02-DIAGNOSTIC', 'a', true, 0) };
    broken.payload = 'not-json';
    expect(toDomainEvents([broken])).toEqual([]);
  });

  it('feeds local answers into a fresh deterministic diagnosis', () => {
    const first = buildLocalAnswerRecord('chi', 'K02-DIAGNOSTIC', 'a', true, 0);
    const withLocal = diagnoseHero('chi', [first]);
    const withoutLocal = diagnoseHero('chi');
    // Same call twice is deterministic; adding evidence must be reflected.
    expect(diagnoseHero('chi', [first])).toEqual(withLocal);
    expect(withLocal.evidenceEventIds).not.toEqual(withoutLocal.evidenceEventIds);
  });

  it('exposes the synthetic class dashboard with a K02 class-wide gap', () => {
    const dashboard = buildHeroClassDashboard();
    expect(dashboard.learners).toHaveLength(40);
    expect(dashboard.groups.length).toBeGreaterThan(0);
    expect(dashboard.classWideGaps.map((gap) => gap.rootKcId)).toContain('K02');
  });

  it('recognizes only the four hero learner IDs', () => {
    expect(isHeroLearnerId('an')).toBe(true);
    expect(isHeroLearnerId('unknown')).toBe(false);
    expect(isHeroLearnerId(undefined)).toBe(false);
  });
});
