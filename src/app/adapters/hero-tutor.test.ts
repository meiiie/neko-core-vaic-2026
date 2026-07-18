import { describe, expect, it } from 'vitest';
import { HERO_EVENTS, type HeroSimulationProfileId } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { learnerEventSchema } from '../../storage/event-repository';
import {
  buildHeroClassDashboard,
  buildConfirmedAssignmentRecord,
  buildHydratedEventRecords,
  canonicalHeroItemId,
  buildLocalAnswerRecord,
  diagnoseHero,
  isHeroLearnerId,
  questionForItem,
  toDomainEvents,
  toHeroClassObservedEvents,
} from './hero-tutor';

const CHI_CONTEXT = { learnerId: 'user-student-chi', simulationProfileId: 'chi' } as const;
const MINH_CONTEXT = { learnerId: 'user-student-minh', simulationProfileId: 'minh' } as const;

function storedHeroRecords(profileId: HeroSimulationProfileId): LearnerEventRecord[] {
  const learnerId = `user-student-${profileId}`;
  return HERO_EVENTS[profileId].map((event) => ({
    id: event.id,
    learnerId,
    itemId: event.itemId,
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    kind: 'SEEDED_EVIDENCE',
    payload: JSON.stringify({
      choiceId: 'seeded-history',
      correct: event.correct,
      methodValidity: event.methodValidity ?? 'UNKNOWN',
      ...(event.misconceptionId ? { misconceptionId: event.misconceptionId } : {}),
    }),
  }));
}

describe('hero-tutor adapter (UI integration over domain runtime)', () => {
  it('reproduces the four hero outcomes through the adapter', () => {
    const an = diagnoseHero(
      { learnerId: 'user-student-an', simulationProfileId: 'an' },
      storedHeroRecords('an'),
    );
    expect(an.status).toBe('DIAGNOSED');
    expect(an.rootKcId).toBe('K02');

    const binh = diagnoseHero(
      { learnerId: 'user-student-binh', simulationProfileId: 'binh' },
      storedHeroRecords('binh'),
    );
    expect(binh.status).toBe('DIAGNOSED');
    expect(binh.rootKcId).toBe('K07');

    const chi = diagnoseHero(CHI_CONTEXT, storedHeroRecords('chi'));
    expect(chi.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(chi.rootKcId).toBeUndefined();

    const minh = diagnoseHero(MINH_CONTEXT, storedHeroRecords('minh'));
    expect(minh.status).toBe('FAST_PATH');
  });

  it('builds schema-valid local answer records with continuing sequence numbers', () => {
    const record = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'a', true, 7);
    expect(() => learnerEventSchema.parse(record)).not.toThrow();
    // Seven hydrated rows exist in IndexedDB, so the next local event is sequence 8.
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
    const result = diagnoseHero(context, storedHeroRecords('an'));
    const record = buildLocalAnswerRecord(context, 'K02-DIAGNOSTIC', 'a', true, 7);

    expect(result).toMatchObject({
      learnerId: 'user-student-an',
      status: 'DIAGNOSED',
      rootKcId: 'K02',
    });
    expect(result.evidenceEventIds).toEqual(['an-event-3', 'an-event-4']);
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
    expect(result.nextItemId).toBe('K01-CHECK-1');
    expect(questionForItem(result.nextItemId ?? '')?.promptVi).toBeTruthy();
  });

  it('keeps the adaptive check-in actionable after Chi answers the first probe', () => {
    for (const choiceId of ['a', 'b', 'c']) {
      const first = buildLocalAnswerRecord(
        CHI_CONTEXT,
        'K02-DIAGNOSTIC',
        choiceId,
        choiceId === 'a',
        0,
      );
      const result = diagnoseHero(CHI_CONTEXT, [first]);
      expect(
        result.status === 'DIAGNOSED' ||
          result.status === 'FAST_PATH' ||
          result.nextItemId !== undefined,
      ).toBe(true);
    }
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
      sequence: 1,
    });
    expect(toDomainEvents(record ? [record] : [])).toEqual([
      expect.objectContaining({
        itemId: 'K02-CHECK-1',
        misconceptionId: 'ADDITIVE_EQUIVALENCE',
      }),
    ]);
  });

  it('keeps a teacher-assignment failure actionable after the surface checks are exhausted', () => {
    const learnerId = 'user-student-7a-09';
    const records: LearnerEventRecord[] = ['K09-CHECK-1', 'K09-CHECK-2'].map((itemId, index) => ({
      id: `assignment-k09-${index + 1}`,
      learnerId,
      itemId: `bank-${itemId}`,
      sequence: index + 1,
      occurredAt: `2026-07-18T16:09:0${index}.000Z`,
      kind: 'ASSIGNMENT_ANSWER',
      payload: JSON.stringify({
        choiceId: 'wrong',
        correct: false,
        methodValidity: 'UNKNOWN',
      }),
    }));

    const result = diagnoseHero({ learnerId }, records);

    expect(result).toMatchObject({
      status: 'NEEDS_MORE_EVIDENCE',
      disposition: 'ASK_VERIFY',
      competingKcIds: ['K09'],
    });
    expect(['K08-CHECK-1', 'K08-CHECK-2']).toContain(result.nextItemId);
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

  it('keeps canonical sequence while ordering a complete hydrated history', () => {
    const context = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;
    const later = buildLocalAnswerRecord(context, 'K02-DIAGNOSTIC', 'a', true, 0);
    const earlier = {
      ...later,
      id: 'evt-earlier',
      sequence: 1,
      occurredAt: '2026-07-18T08:00:00.000Z',
    };
    later.sequence = 2;
    const hydrated = buildHydratedEventRecords(context, [later, earlier]);

    expect(hydrated?.map(({ id, sequence }) => ({ id, sequence }))).toEqual([
      { id: 'evt-earlier', sequence: 1 },
      { id: later.id, sequence: 2 },
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

  it('keeps guided practice and resource views out of mastery evidence', () => {
    const practice = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-CHECK-1', 'a', true, 0, {
      kind: 'PRACTICE_ANSWER',
    });
    const resource = {
      ...practice,
      id: 'resource-view',
      itemId: 'text:K02',
      kind: 'RESOURCE_VIEWED',
      payload: '{"kcId":"K02"}',
    };

    expect(toDomainEvents([practice, resource])).toEqual([]);
  });

  it('feeds local answers into a fresh deterministic diagnosis', () => {
    const existing = storedHeroRecords('chi');
    const first = buildLocalAnswerRecord(CHI_CONTEXT, 'K02-DIAGNOSTIC', 'a', true, existing.length);
    const withLocal = diagnoseHero(CHI_CONTEXT, [...existing, first]);
    const withoutLocal = diagnoseHero(CHI_CONTEXT, existing);
    // Same call twice is deterministic; adding evidence must be reflected.
    expect(diagnoseHero(CHI_CONTEXT, [...existing, first])).toEqual(withLocal);
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
