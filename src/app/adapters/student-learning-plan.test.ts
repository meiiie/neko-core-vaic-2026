import { describe, expect, it } from 'vitest';
import { curriculumCatalogDraft, HERO_EVENTS, type HeroSimulationProfileId } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { diagnoseHero } from './hero-tutor';
import {
  buildResourceViewedRecord,
  deriveStudentLearningPlan,
  selectStudentPhase,
} from './student-learning-plan';

function storedRecords(profileId: HeroSimulationProfileId): LearnerEventRecord[] {
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

function planFor(profileId: HeroSimulationProfileId, records = storedRecords(profileId)) {
  const context = { learnerId: `user-student-${profileId}`, simulationProfileId: profileId };
  return deriveStudentLearningPlan({
    diagnosis: diagnoseHero(context, records),
    catalog: curriculumCatalogDraft,
    records,
  });
}

describe('student learning plan projection', () => {
  it('keeps uncertain and fast-path learners out of fake remediation steps', () => {
    expect(planFor('chi')).toMatchObject({ status: 'NEEDS_CHECK_IN', steps: [] });
    expect(planFor('minh')).toMatchObject({ status: 'FAST_PATH', steps: [] });
  });

  it('projects An and Bình onto distinct cross-grade paths', () => {
    const an = planFor('an');
    expect(an.status).toBe('READY');
    expect(an.steps.map((step) => step.kcId)).toEqual(['K02', 'K08', 'K09', 'K10']);
    expect(an.steps[0]).toMatchObject({
      gradeLabels: [5, 6],
      phase: 'EXPLAIN',
      status: 'CURRENT',
    });

    const binh = planFor('binh');
    expect(binh.steps.map((step) => step.kcId)).toEqual(['K07', 'K08', 'K09', 'K10']);
    expect(binh.steps.map((step) => step.kcId)).not.toContain('K02');
  });

  it('requires a passed independent post-check before completing a step', () => {
    const records = storedRecords('an');
    const learnerId = 'user-student-an';
    const viewed: LearnerEventRecord = {
      id: 'view-k02',
      learnerId,
      itemId: 'text:K02',
      sequence: 100,
      occurredAt: '2026-07-18T10:00:00.000Z',
      kind: 'RESOURCE_VIEWED',
      payload: JSON.stringify({ kcId: 'K02' }),
    };
    const practice: LearnerEventRecord = {
      ...viewed,
      id: 'practice-k02',
      itemId: 'K02-CHECK-1',
      sequence: 101,
      kind: 'PRACTICE_ANSWER',
      payload: JSON.stringify({ correct: true }),
    };
    const practiceSecond: LearnerEventRecord = {
      ...practice,
      id: 'practice-k02-2',
      itemId: 'K02-CHECK-1b',
      sequence: 102,
    };
    const practiceThird: LearnerEventRecord = {
      ...practice,
      id: 'practice-k02-3',
      itemId: 'K02-CHECK-1c',
      sequence: 103,
    };
    const check: LearnerEventRecord = {
      ...practice,
      id: 'check-k02',
      itemId: 'K02-CHECK-2',
      sequence: 104,
      kind: 'POST_CHECK_ANSWER',
    };

    // K02 has a 3-item guided pool, so the gate is ACCURACY (3 distinct correct)
    // AND a final 2-correct streak. One or two correct answers are not enough.
    expect(selectStudentPhase('K02', [...records, viewed])).toBe('GUIDED_PRACTICE');
    expect(selectStudentPhase('K02', [...records, viewed, practice])).toBe('GUIDED_PRACTICE');
    expect(
      selectStudentPhase('K02', [...records, viewed, practice, practiceSecond]),
    ).toBe('GUIDED_PRACTICE');
    expect(
      selectStudentPhase('K02', [
        ...records,
        viewed,
        practice,
        practiceSecond,
        practiceThird,
      ]),
    ).toBe('POST_CHECK');
    expect(
      selectStudentPhase('K02', [
        ...records,
        viewed,
        practice,
        practiceSecond,
        practiceThird,
        check,
      ]),
    ).toBe('DONE');

    const progressed = planFor('an', [
      ...records,
      viewed,
      practice,
      practiceSecond,
      practiceThird,
      check,
    ]);
    expect(progressed.steps[0]?.status).toBe('DONE');
    expect(progressed.currentStepIndex).toBe(1);

    const refreshedDiagnosis = diagnoseHero({ learnerId, simulationProfileId: 'an' }, [
      ...records,
      viewed,
      practice,
      practiceSecond,
      practiceThird,
      check,
    ]);
    const refreshedPlan = deriveStudentLearningPlan({
      diagnosis: refreshedDiagnosis,
      catalog: curriculumCatalogDraft,
      records: [
        ...records,
        viewed,
        practice,
        practiceSecond,
        practiceThird,
        check,
      ],
    });
    expect(refreshedPlan.steps[0]?.status).toBe('DONE');
    expect(refreshedPlan.steps[refreshedPlan.currentStepIndex ?? -1]?.kcId).toBe('K08');
  });

  it('stays in GUIDED_PRACTICE after many wrong answers so the learner is never stuck (no dead-end)', () => {
    const records = storedRecords('an');
    const learnerId = 'user-student-an';
    const viewed: LearnerEventRecord = {
      id: 'view-k02',
      learnerId,
      itemId: 'text:K02',
      sequence: 100,
      occurredAt: '2026-07-18T10:00:00.000Z',
      kind: 'RESOURCE_VIEWED',
      payload: JSON.stringify({ kcId: 'K02' }),
    };
    const wrong = (seq: number, itemId: string): LearnerEventRecord => ({
      id: `wrong-${seq}`,
      learnerId,
      itemId,
      sequence: seq,
      occurredAt: '2026-07-18T10:00:00.000Z',
      kind: 'PRACTICE_ANSWER',
      payload: JSON.stringify({ choiceId: 'b', correct: false, kcId: 'K02' }),
    });
    // Wrong answers never revert the phase to EXPLAIN. The learner stays in
    // GUIDED_PRACTICE and the UI shows a non-blocking review nudge instead.
    // This avoids the dead-end where a learner reads the summary but cannot
    // resume practice because the phase keeps flipping back to EXPLAIN.
    expect(
      selectStudentPhase('K02', [
        ...records,
        viewed,
        wrong(101, 'K02-CHECK-1'),
        wrong(102, 'K02-CHECK-1b'),
        wrong(103, 'K02-CHECK-1'),
      ]),
    ).toBe('GUIDED_PRACTICE');
  });

  it('never treats opening a resource as mastery', () => {
    const records: LearnerEventRecord[] = [
      {
        id: 'view-only',
        learnerId: 'learner',
        itemId: 'resource-1',
        sequence: 1,
        occurredAt: '2026-07-18T10:00:00.000Z',
        kind: 'RESOURCE_VIEWED',
        payload: JSON.stringify({ kcId: 'K02' }),
      },
    ];
    expect(selectStudentPhase('K02', records)).toBe('GUIDED_PRACTICE');
  });

  it('builds a text-view event after the latest learner sequence, with a sequence-unique id', () => {
    const existing = storedRecords('an');
    const nextSequence = Math.max(...existing.map((record) => record.sequence)) + 1;
    expect(
      buildResourceViewedRecord('user-student-an', 'K02', existing, '2026-07-18T10:00:00.000Z'),
    ).toMatchObject({
      // The id carries the sequence so a re-view creates a NEW record instead
      // of overwriting the first — this is what lets the wrong-answer streak
      // actually reset when a learner returns from the review nudge.
      id: `user-student-an:resource-viewed:text:K02:${nextSequence}`,
      itemId: 'text:K02',
      sequence: nextSequence,
      kind: 'RESOURCE_VIEWED',
    });
  });

  it('assigns distinct ids to repeated text-view events so re-review is not deduped', () => {
    const existing = storedRecords('an');
    const first = buildResourceViewedRecord(
      'user-student-an',
      'K02',
      existing,
      '2026-07-18T10:00:00.000Z',
    );
    const second = buildResourceViewedRecord(
      'user-student-an',
      'K02',
      [...existing, first],
      '2026-07-18T11:00:00.000Z',
    );
    expect(second.id).not.toBe(first.id);
    expect(second.sequence).toBe(first.sequence + 1);
  });
});
