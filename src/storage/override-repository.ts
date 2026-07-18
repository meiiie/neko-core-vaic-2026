import { z } from 'zod';
import { db, type NekoPathDb, type OverrideRecord } from './db';

export const teacherOverrideSchema = z
  .object({
    id: z.string().min(1),
    learnerId: z.string().min(1),
    targetKcId: z.string().min(1),
    decision: z.enum(['SET_ROOT', 'NEEDS_MORE_EVIDENCE']),
    rootKcId: z.string().min(1).optional(),
    reason: z.string().trim().min(8).max(240),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'SET_ROOT' && !value.rootKcId) {
      context.addIssue({
        code: 'custom',
        path: ['rootKcId'],
        message: 'SET_ROOT requires rootKcId',
      });
    }
    if (value.decision === 'NEEDS_MORE_EVIDENCE' && value.rootKcId) {
      context.addIssue({
        code: 'custom',
        path: ['rootKcId'],
        message: 'NEEDS_MORE_EVIDENCE cannot set rootKcId',
      });
    }
  });

export async function appendTeacherOverride(
  override: OverrideRecord,
  database: NekoPathDb = db,
): Promise<'APPENDED' | 'DUPLICATE_IGNORED'> {
  const parsed = teacherOverrideSchema.parse(override);
  try {
    await database.transaction('rw', [database.overrides, database.meta], async () => {
      await database.overrides.add(parsed);
      await database.meta.put({
        key: 'lastLocalWriteAt',
        value: parsed.updatedAt,
        updatedAt: parsed.updatedAt,
      });
    });
    return 'APPENDED';
  } catch (error) {
    if (error instanceof Error && error.name === 'ConstraintError') return 'DUPLICATE_IGNORED';
    throw error;
  }
}

export async function listLatestTeacherOverrides(
  database: NekoPathDb = db,
): Promise<OverrideRecord[]> {
  const rows = (await database.overrides.toArray()).map((row) => teacherOverrideSchema.parse(row));
  rows.sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id),
  );
  const latest = new Map<string, OverrideRecord>();
  for (const row of rows) {
    const key = `${row.learnerId}:${row.targetKcId}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].sort(
    (left, right) =>
      left.learnerId.localeCompare(right.learnerId) ||
      left.targetKcId.localeCompare(right.targetKcId),
  );
}
