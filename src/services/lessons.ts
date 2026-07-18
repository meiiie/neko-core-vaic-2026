import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LessonRecord, type NekoPathDb } from '../storage/db';

/**
 * Lesson materials, local-first: the server owns the rows (teachers edit them
 * there); this mirror refreshes on app start and reconnect so a student can
 * open every summary offline. First-ever load needs one network round trip —
 * the same honest constraint as the class directory.
 */

export type LessonRefreshResult = 'REFRESHED' | 'OFFLINE' | 'FAILED';

export async function refreshLessons(database: NekoPathDb = db): Promise<LessonRefreshResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'OFFLINE';
  try {
    const response = await fetch('/api/lessons', { credentials: 'include' });
    if (!response.ok) return 'FAILED';
    const body = (await response.json()) as { lessons: LessonRecord[] };
    await database.transaction('rw', [database.lessons, database.meta], async () => {
      await database.lessons.bulkPut(body.lessons);
      await database.meta.put({
        key: 'lessonsRefreshedAt',
        value: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    return 'REFRESHED';
  } catch {
    return 'FAILED';
  }
}

/** undefined = still reading IndexedDB; null = not on this device yet. */
export function useLesson(kcId: string): { lesson: LessonRecord | null } | undefined {
  return useLiveQuery(async () => ({ lesson: (await db.lessons.get(kcId)) ?? null }), [kcId]);
}

/** KC IDs that have a lesson available on this device. */
export function useLessonKcIds(): ReadonlySet<string> | undefined {
  return useLiveQuery(async () => {
    const keys = (await db.lessons.toCollection().primaryKeys()) as string[];
    return new Set(keys);
  }, []);
}

/** Full list for the teacher editing surface, ordered by KC. */
export function useLessonList(): LessonRecord[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.lessons.toArray();
    return rows.sort((a, b) => a.kcId.localeCompare(b.kcId));
  }, []);
}
