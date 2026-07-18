import graphDraftJson from './graph.v1.json';
import { contentGraphSchema, toDomainGraph } from './schema';

export const contentGraphDraft = contentGraphSchema.parse(graphDraftJson);
export const curriculumGraphDraft = toDomainGraph(contentGraphDraft);

export * from './hero-class';
export * from './hero-demo';
export * from './hero-misconceptions';
export * from './hero-practice';
export * from './schema';
