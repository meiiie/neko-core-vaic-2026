import { describe, expect, it } from 'vitest';
import { learnerEventSchema } from '../../storage/event-repository';
import {
  buildHeroClassDashboard,
  buildConfirmedAssignmentRecord,
  buildHydratedEventRecords,
  canonicalHeroItemId,
  buildLocalAnswerRecord,
  diagnoseHero,
  isHeroLearnerId,
  toDomainEvents,
  toHeroClassObservedEvents,
} from './hero-tutor';

const CHI_CONTEXT = { learnerId: 'user-student-chi', simulationProfileId: 'chi' } as const;
const MINH_CONTEXT = { learnerId: 'user-student-minh', simulationProfileId: 'minh' } as const;

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
    const record = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'a', true, 0);
    expect(() => learnerEventSchema.parse(record)).not.toThrow();
    // Chi has 7 seeded events (sequence 1..7); the first local answer continues after them.
    expect(record.sequence).toBe(8);

    const [event] = toDomainEvents([record]);
    expect(event).toMatchObject({
      learnerId: 'user-student-chi',
      itemId: 'K02-DIAGNOSTIC',
      correct: true,
      methodValidity: 'UNKNOWN',
    });
  });

  it('rekeys hero evidence to the account ID while preserving the simulated outcome', () => {
    const context = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;
    const result = diagnoseHero(context);
    const record = buildLocalAnswerRecord(context, 'K02-DIAGNOSTIC', 'a', true, 0);

    expect(result).toMatchObject({
      learnerId: 'user-student-an',
      status: 'DIAGNOSED',
      rootKcId: 'K02',
    });
    expect(result.evidenceEventIds.every((id) => id.startsWith('user-student-an-'))).toBe(true);
    expect(record).toMatchObject({ learnerId: 'user-student-an', sequence: 8 });
  });

  it('starts a non-hero student from isolated empty evidence instead of Chi', () => {
    const context = { learnerId: 'user-student-7a-01' } as const;
    const result = diagnoseHero(context);
    const record = buildLocalAnswerRecord(context, 'K02-DIAGNOSTIC', 'a', true, 0);

    expect(result).toMatchObject({
      learnerId: 'user-student-7a-01',
      status: 'NEEDS_MORE_EVIDENCE',
    });
    expect(result.evidenceEventIds).toEqual([]);
    expect(record).toMatchObject({ learnerId: 'user-student-7a-01', sequence: 1 });
  });

  it('maps account-owned demo events only at the synthetic teacher boundary', () => {
    const heroRecord = buildLocalAnswerRecord(
      { learnerId: 'user-student-an', simulationProfileId: 'an' },
      'K02-DIAGNOSTIC',
      'a',
      true,
      0,
    );
    const nonHeroRecord = buildLocalAnswerRecord(
      { learnerId: 'user-student-7a-01' },
      'K02-DIAGNOSTIC',
      'a',
      true,
      0,
    );

    expect(toHeroClassObservedEvents([heroRecord, nonHeroRecord])).toEqual([
      expect.objectContaining({ id: heroRecord.id, learnerId: 'an' }),
    ]);
    expect(toDomainEvents([heroRecord])[0].learnerId).toBe('user-student-an');
  });

  it('turns a confirmed bank answer into canonical local diagnosis evidence', () => {
    const context = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;
    const record = buildConfirmedAssignmentRecord(
      context,
      {
        id: 'evt-assignment-1',
        learnerId: context.learnerId,
        itemId: 'bank-K02-CHECK-1',
        sequence: 1,
        occurredAt: '2026-07-18T09:00:00.000Z',
        kind: 'ASSIGNMENT_ANSWER',
        payload: JSON.stringify({
          choiceId: 'b',
          correct: false,
          methodValidity: 'INVALID',
          misconceptionId: 'ADDITIVE_EQUIVALENCE',
        }),
      },
      0,
    );

    expect(record).toMatchObject({
      learnerId: context.learnerId,
      itemId: 'bank-K02-CHECK-1',
      sequence: 8,
    });
    expect(toDomainEvents(record ? [record] : [])).toEqual([
      expect.objectContaining({
        itemId: 'K02-CHECK-1',
        misconceptionId: 'ADDITIVE_EQUIVALENCE',
      }),
    ]);
  });

  it('rejects a confirmed assignment event owned by another account', () => {
    expect(
      buildConfirmedAssignmentRecord(
        { learnerId: 'user-student-an', simulationProfileId: 'an' },
        {
          id: 'evt-wrong-owner',
          learnerId: 'user-student-chi',
          itemId: 'bank-K02-CHECK-1',
          sequence: 1,
          occurredAt: '2026-07-18T09:00:00.000Z',
          kind: 'ASSIGNMENT_ANSWER',
          payload: '{"choiceId":"a","correct":true}',
        },
        0,
      ),
    ).toBeNull();
  });

  it('orders a complete hydrated history after seeded evidence', () => {
    const context = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;
    const later = buildLocalAnswerRecord(context, 'K02-DIAGNOSTIC', 'a', true, 0);
    const earlier = { ...later, id: 'evt-earlier', occurredAt: '2026-07-18T08:00:00.000Z' };
    const hydrated = buildHydratedEventRecords(context, [later, earlier]);

    expect(hydrated?.map(({ id, sequence }) => ({ id, sequence }))).toEqual([
      { id: 'evt-earlier', sequence: 8 },
      { id: later.id, sequence: 9 },
    ]);
    expect(
      buildHydratedEventRecords(context, [{ ...earlier, learnerId: 'user-student-chi' }]),
    ).toBeNull();
  });

  it('persists structured misconception evidence from an authored distractor', () => {
    const record = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'b', false, 0, {
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
      methodValidity: 'INVALID',
    });

    expect(toDomainEvents([record])[0]).toMatchObject({
      correct: false,
      methodValidity: 'INVALID',
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
    });
  });

  it('infers invalid method evidence for an authored transfer distractor', () => {
    const record = buildLocalAnswerRecord(MINH_CONTEXT, 'K10-TRANSFER', 'b', false, 0);

    expect(toDomainEvents([record])[0]).toMatchObject({
      correct: false,
      methodValidity: 'INVALID',
      misconceptionId: 'ADDITIVE_COMPARISON',
    });
  });

  it('drops a stale or mismatched misconception ID from local storage', () => {
    const record = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'a', true, 0);
    record.payload = JSON.stringify({
      choiceId: 'a',
      correct: true,
      methodValidity: 'UNKNOWN',
      misconceptionId: 'RATIO_ORDER_REVERSED',
    });

    expect(toDomainEvents([record])[0]).not.toHaveProperty('misconceptionId');
    expect(() => diagnoseHero(CHI_CONTEXT, [record])).not.toThrow();
  });

  it('skips malformed local payloads instead of guessing', () => {
    const broken = {
      ...buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'a', true, 0),
    };
    broken.payload = 'not-json';
    expect(toDomainEvents([broken])).toEqual([]);
  });

  it('feeds local answers into a fresh deterministic diagnosis', () => {
    const first = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'a', true, 0);
    const withLocal = diagnoseHero(CHI_CONTEXT, [first]);
    const withoutLocal = diagnoseHero(CHI_CONTEXT);
    // Same call twice is deterministic; adding evidence must be reflected.
    expect(diagnoseHero(CHI_CONTEXT, [first])).toEqual(withLocal);
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

  it('canonicalizes only known direct and teacher-bank item IDs', () => {
    expect(canonicalHeroItemId('K02-CHECK-1')).toBe('K02-CHECK-1');
    expect(canonicalHeroItemId('bank-K02-CHECK-1')).toBe('K02-CHECK-1');
    expect(canonicalHeroItemId('bank-unknown')).toBeUndefined();
  });
});
