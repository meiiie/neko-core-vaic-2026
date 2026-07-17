import { describe, expect, it } from 'vitest';
import { topologicalOrder } from '../domain';
import graphDraftJson from './graph.v1.json';
import { contentGraphDraft, contentGraphSchema, curriculumGraphDraft } from './index';

describe('curriculum draft gate', () => {
  it('parses the versioned 12-KC, 13-edge DAG', () => {
    expect(contentGraphDraft.nodes).toHaveLength(12);
    expect(contentGraphDraft.edges).toHaveLength(13);
    expect(topologicalOrder(curriculumGraphDraft)).toHaveLength(12);
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
