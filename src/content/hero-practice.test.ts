import { describe, expect, it } from 'vitest';
import { diagnose } from '../domain';
import { HERO_DEMO_CONFIG, HERO_EVENTS, HERO_GRAPH, HERO_ITEMS } from './hero-demo';
import { HERO_MISCONCEPTIONS } from './hero-misconceptions';
import { PRACTICE_QUESTIONS, practiceQuestionsForKc } from './hero-practice';

describe('Practice question bank', () => {
  it('binds every diagnosis-bound question to an existing item of the same KC, and keeps guided variants practice-only', () => {
    const itemsById = new Map(HERO_ITEMS.map((item) => [item.id, item]));
    for (const question of PRACTICE_QUESTIONS) {
      const item = itemsById.get(question.itemId);
      if (item) {
        // Diagnosis-bound questions (the primary -CHECK-1 and the post-check
        // -CHECK-2) must match an item of the same KC.
        expect(item.kcIds).toContain(question.kcId);
      } else {
        // Guided variants (e.g. -CHECK-1b) widen the anti-guessing streak pool
        // but are intentionally not diagnosis items, so they must still bind to
        // the same KC via their itemId and share the -CHECK-1 numeric template.
        expect(question.itemId).toMatch(/^K\d{2}-CHECK-1[a-z]?$/);
        expect(question.kcId).toBe(question.itemId.slice(0, 3));
      }
    }
  });

  it('covers every hero-graph KC with at least two questions', () => {
    for (const node of HERO_GRAPH.nodes) {
      expect(
        practiceQuestionsForKc(node.id).length,
        `KC ${node.id} needs practice content`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('tags every wrong choice with a defined misconception and note, never the correct one', () => {
    const definitions = new Set(HERO_MISCONCEPTIONS.map((definition) => definition.id));
    const itemsById = new Map(HERO_ITEMS.map((item) => [item.id, item]));
    for (const question of PRACTICE_QUESTIONS) {
      const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
      expect(correct, question.itemId).toBeTruthy();
      expect(correct?.misconceptionTag).toBeUndefined();
      const itemMisconceptionIds = itemsById.get(question.itemId)?.misconceptionIds ?? [];
      for (const choice of question.choices) {
        if (choice.id === question.correctChoiceId) continue;
        expect(choice.misconceptionTag, `${question.itemId}/${choice.id}`).toBeTruthy();
        expect(choice.noteVi, `${question.itemId}/${choice.id}`).toBeTruthy();
        expect(definitions.has(choice.misconceptionTag!), choice.misconceptionTag).toBe(true);
        // Guided variants reuse authored misconceptions; only the primary
        // diagnosis items declare the misconceptionId list on the domain Item.
        if (itemMisconceptionIds.length > 0) {
          expect(itemMisconceptionIds).toContain(choice.misconceptionTag);
        }
      }
    }
  });

  it('never reveals the correct answer inside hints 1–2 (bottom-out is level 3 only)', () => {
    for (const question of PRACTICE_QUESTIONS) {
      const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
      const answerCore = correct?.label.replace(/[^0-9/:]/g, '') ?? '';
      if (answerCore.length < 2) continue; // answers like single digits appear in many contexts
      for (const hint of question.hints.slice(0, 2)) {
        expect(
          hint.replace(/\s+/g, '').includes(answerCore),
          `${question.itemId} leaks answer in early hint`,
        ).toBe(false);
      }
    }
  });

  it('practising the diagnosed root moves An through the real path', () => {
    // An starts with a K02 gap. Answer K02 practice items correctly and the
    // deterministic core must eventually move the frontier past K02.
    const extra = Array.from({ length: 4 }, (_, index) => ({
      id: `an-practice-${index + 1}`,
      learnerId: 'an',
      itemId: index % 2 === 0 ? 'K02-CHECK-1' : 'K02-CHECK-2',
      sequence: 100 + index,
      occurredAt: `2026-07-17T10:0${index}:00.000Z`,
      correct: true,
    }));
    const before = diagnose({
      learnerId: 'an',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: HERO_EVENTS.an,
      config: HERO_DEMO_CONFIG,
    });
    const after = diagnose({
      learnerId: 'an',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: [...HERO_EVENTS.an, ...extra],
      config: HERO_DEMO_CONFIG,
    });
    expect(before.rootKcId).toBe('K02');
    expect(after.rootKcId).not.toBe('K02');
    expect(after.pathKcIds).not.toContain('K02');
  });
});
