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
    const check: LearnerEventRecord = {
      ...practice,
      id: 'check-k02',
      itemId: 'K02-CHECK-2',
      sequence: 102,
      kind: 'POST_CHECK_ANSWER',
    };

    expect(selectStudentPhase('K02', [...records, viewed])).toBe('GUIDED_PRACTICE');
    expect(selectStudentPhase('K02', [...records, viewed, practice])).toBe('POST_CHECK');
    expect(selectStudentPhase('K02', [...records, viewed, practice, check])).toBe('DONE');

    const progressed = planFor('an', [...records, viewed, practice, check]);
    expect(progressed.steps[0]?.status).toBe('DONE');
    expect(progressed.currentStepIndex).toBe(1);

    const refreshedDiagnosis = diagnoseHero({ learnerId, simulationProfileId: 'an' }, [
      ...records,
      viewed,
      practice,
      check,
    ]);
    const refreshedPlan = deriveStudentLearningPlan({
      diagnosis: refreshedDiagnosis,
      catalog: curriculumCatalogDraft,
      records: [...records, viewed, practice, check],
    });
    expect(refreshedPlan.steps[0]?.status).toBe('DONE');
    expect(refreshedPlan.steps[refreshedPlan.currentStepIndex ?? -1]?.kcId).toBe('K08');
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

  it('builds an idempotent text-view event after the latest learner sequence', () => {
    const existing = storedRecords('an');
    expect(
      buildResourceViewedRecord('user-student-an', 'K02', existing, '2026-07-18T10:00:00.000Z'),
    ).toMatchObject({
      id: 'user-student-an:resource-viewed:text:K02',
      itemId: 'text:K02',
      sequence: Math.max(...existing.map((record) => record.sequence)) + 1,
      kind: 'RESOURCE_VIEWED',
    });
  });
});
