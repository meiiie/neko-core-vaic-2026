import { describe, expect, it } from 'vitest';
import type { ResourceRecord } from '../../storage/db';
import { selectResourcesForStep } from './resource-selection';

function resource(
  overrides: Partial<ResourceRecord> & Pick<ResourceRecord, 'id' | 'role'>,
): ResourceRecord {
  const { id, role, ...rest } = overrides;
  return {
    id,
    kcId: 'K02',
    kind: overrides.role === 'EXPLAIN' ? 'VIDEO' : 'PDF',
    role,
    title: overrides.id,
    fileName: `${overrides.id}.pdf`,
    mimeType: 'application/pdf',
    durationSeconds: null,
    transcriptVi: null,
    byteSize: 1000,
    sha256: 'a'.repeat(64),
    sortOrder: 0,
    status: 'PUBLISHED',
    reviewState: 'ACCEPTED',
    gradeMin: 5,
    gradeMax: 7,
    createdAt: '2026-07-18T00:00:00.000Z',
    uploadedByName: 'Cô Hà',
    ...rest,
  };
}

describe('resource selection', () => {
  it('selects the shortest explanation and smallest summary deterministically', () => {
    const selected = selectResourcesForStep({ kcId: 'K02', gradeLabels: [5, 6] }, [
      resource({ id: 'video-long', role: 'EXPLAIN', durationSeconds: 300 }),
      resource({ id: 'video-short', role: 'EXPLAIN', durationSeconds: 90 }),
      resource({ id: 'pdf-large', role: 'SUMMARY', byteSize: 5000 }),
      resource({ id: 'pdf-small', role: 'SUMMARY', byteSize: 1200 }),
    ]);
    expect(selected.map(({ id }) => id)).toEqual(['video-short', 'pdf-small']);
  });

  it('fails closed for drafts, rejected or wrong-grade resources', () => {
    expect(
      selectResourcesForStep({ kcId: 'K02', gradeLabels: [5] }, [
        resource({ id: 'draft', role: 'SUMMARY', status: 'DRAFT' }),
        resource({ id: 'rejected', role: 'SUMMARY', reviewState: 'REJECTED' }),
        resource({ id: 'grade-7', role: 'SUMMARY', gradeMin: 7, gradeMax: 7 }),
      ]),
    ).toEqual([]);
  });
});
