import graphDraftJson from './graph.v1.json';
import { contentGraphSchema, toCurriculumCatalog, toDomainGraph } from './schema';

/**
 * The parsed, versioned curriculum draft is the single runtime source for
 * nodes, edges and presentation metadata. Demo content may support only a
 * subset of these KCs, but it must not maintain a second graph.
 */
export const contentGraphDraft = contentGraphSchema.parse(graphDraftJson);
export const curriculumGraphDraft = toDomainGraph(contentGraphDraft);
export const curriculumCatalogDraft = toCurriculumCatalog(contentGraphDraft);
