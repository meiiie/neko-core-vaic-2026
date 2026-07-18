import { describe, expect, it } from 'vitest';
import { topologicalOrder } from '../domain';
import graphDraftJson from './graph.v1.json';
import {
  contentGraphDraft,
  contentGraphSchema,
  curriculumGraphDraft,
  HERO_GRAPH,
  HERO_ITEMS,
  HERO_MISCONCEPTIONS,
  HERO_QUESTIONS,
  HERO_SUPPORTED_KC_IDS,
  pilotCurriculumIssues,
  assertPilotCurriculumReady,
} from './index';

describe('curriculum draft gate', () => {
  it('parses the versioned 12-KC, 13-edge DAG', () => {
    expect(contentGraphDraft.nodes).toHaveLength(12);
    expect(contentGraphDraft.edges).toHaveLength(13);
    expect(topologicalOrder(curriculumGraphDraft)).toHaveLength(12);
  });

  it('derives the supported runtime graph from the parsed content graph', () => {
    expect(HERO_GRAPH.version).toBe(curriculumGraphDraft.version);
    expect(HERO_GRAPH.nodes.map(({ id }) => id)).toEqual(
      curriculumGraphDraft.nodes
        .filter(({ id }) =>
          HERO_SUPPORTED_KC_IDS.includes(id as (typeof HERO_SUPPORTED_KC_IDS)[number]),
        )
        .map(({ id }) => id),
    );
    expect(HERO_GRAPH.edges).toEqual(
      curriculumGraphDraft.edges.filter(
        ({ from, to }) =>
          HERO_SUPPORTED_KC_IDS.includes(from as (typeof HERO_SUPPORTED_KC_IDS)[number]) &&
          HERO_SUPPORTED_KC_IDS.includes(to as (typeof HERO_SUPPORTED_KC_IDS)[number]),
      ),
    );
  });

  it('keeps every curriculum claim explicitly unreviewed', () => {
    const reviews = [
      ...contentGraphDraft.nodes.map((node) => node.review),
      ...contentGraphDraft.edges.map((edge) => edge.review),
    ];

    expect(reviews.every((review) => review.state === 'UNREVIEWED')).toBe(true);
    expect(reviews.every((review) => review.reviewer === null && review.reviewedAt === null)).toBe(
      true,
    );
  });

  it('fails the pilot gate instead of promoting unreviewed content', () => {
    expect(pilotCurriculumIssues()).toEqual(
      expect.arrayContaining(['node:K02:UNREVIEWED', 'lesson:K10:UNREVIEWED']),
    );
    expect(() => assertPilotCurriculumReady()).toThrow('Pilot curriculum is not human-reviewed');
  });

  it('keeps every hero item unreviewed and labels every visible question', () => {
    expect(HERO_ITEMS.every((item) => item.reviewState === 'UNREVIEWED')).toBe(true);
    expect(HERO_QUESTIONS).not.toHaveLength(0);
    expect(
      HERO_QUESTIONS.every((question) =>
        question.hypothesisLabel.toLocaleLowerCase('vi').includes('chưa được giáo viên duyệt'),
      ),
    ).toBe(true);
  });

  it('keeps every authored distractor inside the declared misconception vocabulary', () => {
    const definitions = new Set(HERO_MISCONCEPTIONS.map((definition) => definition.id));
    const items = new Map(HERO_ITEMS.map((item) => [item.id, item]));
    for (const question of HERO_QUESTIONS) {
      for (const choice of question.choices) {
        if (!choice.misconceptionId) continue;
        expect(definitions.has(choice.misconceptionId)).toBe(true);
        expect(items.get(question.itemId)?.misconceptionIds).toContain(choice.misconceptionId);
      }
    }
  });

  it('rejects duplicate IDs, unknown sources and cyclic edges', () => {
    const duplicateNode = structuredClone(graphDraftJson);
    duplicateNode.nodes[1]!.id = duplicateNode.nodes[0]!.id;
    expect(contentGraphSchema.safeParse(duplicateNode).success).toBe(false);

    const unknownSource = structuredClone(graphDraftJson);
    unknownSource.nodes[0]!.curriculumAnchors[0]!.sourceId = 'UNKNOWN';
    expect(contentGraphSchema.safeParse(unknownSource).success).toBe(false);

    const cyclic = structuredClone(graphDraftJson);
    cyclic.edges.push({
      from: 'K11',
      to: 'K01',
      scope: 'AUTHORED_ITEMS',
      rationaleVi: 'Invalid cycle fixture.',
      review: {
        state: 'UNREVIEWED',
        reviewer: null,
        reviewedAt: null,
        note: 'Test only.',
      },
    });
    expect(contentGraphSchema.safeParse(cyclic).success).toBe(false);
  });
});
