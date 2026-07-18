import { z } from 'zod';
import { topologicalOrder, type CurriculumGraph, type ReviewState } from '../domain';

export interface CurriculumAnchorView {
  readonly grade: number;
  readonly outcomeSummaryVi: string;
  readonly sourceId: string;
  readonly reviewState: ReviewState;
}

export interface CurriculumNodeView {
  readonly id: string;
  readonly titleVi: string;
  readonly observableBehaviorVi: string;
  readonly anchors: readonly CurriculumAnchorView[];
  readonly reviewState: ReviewState;
}

const reviewSchema = z
  .object({
    state: z.enum(['UNREVIEWED', 'ACCEPTED', 'REVISE', 'REJECTED']),
    reviewer: z.string().min(1).nullable(),
    reviewedAt: z.string().datetime({ offset: true }).nullable(),
    note: z.string().min(1),
  })
  .strict();

const sourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
    note: z.string().min(1),
  })
  .strict();

const anchorSchema = z
  .object({
    sourceId: z.string().min(1),
    grade: z.number().int().min(1).max(12),
    summaryVi: z.string().min(1),
  })
  .strict();

const knowledgeComponentSchema = z
  .object({
    id: z.string().regex(/^K\d{2}$/),
    nameVi: z.string().min(1),
    observableBehaviorVi: z.string().min(1),
    curriculumAnchors: z.array(anchorSchema).min(1),
    review: reviewSchema,
  })
  .strict();

const edgeSchema = z
  .object({
    from: z.string().regex(/^K\d{2}$/),
    to: z.string().regex(/^K\d{2}$/),
    scope: z.enum(['AUTHORED_ITEMS', 'GENERAL_PREREQUISITE']),
    rationaleVi: z.string().min(1),
    review: reviewSchema,
  })
  .strict();

export const contentGraphSchema = z
  .object({
    version: z.string().min(1),
    title: z.string().min(1),
    status: z.literal('DRAFT'),
    sources: z.array(sourceSchema).min(1),
    nodes: z.array(knowledgeComponentSchema).min(1),
    edges: z.array(edgeSchema),
  })
  .strict()
  .superRefine((graph, context) => {
    const sourceIds = new Set<string>();
    graph.sources.forEach((source, index) => {
      if (sourceIds.has(source.id)) {
        context.addIssue({
          code: 'custom',
          path: ['sources', index, 'id'],
          message: 'Duplicate source id',
        });
      }
      sourceIds.add(source.id);
    });

    const nodeIds = new Set<string>();
    graph.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: 'Duplicate KC id',
        });
      }
      nodeIds.add(node.id);
      node.curriculumAnchors.forEach((anchor, anchorIndex) => {
        if (!sourceIds.has(anchor.sourceId)) {
          context.addIssue({
            code: 'custom',
            path: ['nodes', index, 'curriculumAnchors', anchorIndex, 'sourceId'],
            message: 'Unknown source id',
          });
        }
      });
    });

    const edgeIds = new Set<string>();
    graph.edges.forEach((edge, index) => {
      const edgeId = `${edge.from}->${edge.to}`;
      if (edgeIds.has(edgeId)) {
        context.addIssue({ code: 'custom', path: ['edges', index], message: 'Duplicate edge' });
      }
      edgeIds.add(edgeId);
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'Edge references unknown KC',
        });
      }
    });

    if (context.issues.length === 0) {
      try {
        topologicalOrder({
          version: graph.version,
          nodes: graph.nodes.map((node) => ({ id: node.id, name: node.nameVi })),
          edges: graph.edges.map(({ from, to }) => ({ from, to })),
        });
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['edges'],
          message: error instanceof Error ? error.message : 'Invalid graph',
        });
      }
    }
  });

export type ContentGraph = z.infer<typeof contentGraphSchema>;

export function toDomainGraph(content: ContentGraph): CurriculumGraph {
  return {
    version: content.version,
    nodes: content.nodes.map((node) => ({ id: node.id, name: node.nameVi })),
    edges: content.edges.map(({ from, to }) => ({ from, to })),
  };
}

export function toSupportedDomainGraph(
  content: ContentGraph,
  supportedKcIds: readonly string[],
): CurriculumGraph {
  const supported = new Set(supportedKcIds);
  const unknownIds = supportedKcIds.filter(
    (kcId) => !content.nodes.some((node) => node.id === kcId),
  );
  if (unknownIds.length > 0) {
    throw new Error(`Unknown supported KC ids: ${unknownIds.join(', ')}`);
  }
  return {
    version: content.version,
    nodes: content.nodes
      .filter((node) => supported.has(node.id))
      .map((node) => ({ id: node.id, name: node.nameVi })),
    edges: content.edges
      .filter((edge) => supported.has(edge.from) && supported.has(edge.to))
      .map(({ from, to }) => ({ from, to })),
  };
}

export function toCurriculumCatalog(content: ContentGraph): readonly CurriculumNodeView[] {
  return content.nodes.map((node) => ({
    id: node.id,
    titleVi: node.nameVi,
    observableBehaviorVi: node.observableBehaviorVi,
    anchors: node.curriculumAnchors.map((anchor) => ({
      grade: anchor.grade,
      outcomeSummaryVi: anchor.summaryVi,
      sourceId: anchor.sourceId,
      reviewState: node.review.state,
    })),
    reviewState: node.review.state,
  }));
}
