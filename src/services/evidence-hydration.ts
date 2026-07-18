import { z } from 'zod';
import { learnerEventSchema } from '../storage/event-repository';
import type { LearnerEventRecord } from '../storage/db';
import { fetchWithDeadline } from './fetch-with-deadline';

const eventPageSchema = z.object({
  events: z.array(learnerEventSchema).max(200),
  nextOffset: z.number().int().nonnegative().nullable(),
});

const HYDRATION_DEADLINE_MS = 3_000;
const MAX_EVENT_PAGES = 50;

export type ServerEvidenceResult =
  | { readonly events: readonly LearnerEventRecord[] }
  | { readonly skipped: 'OFFLINE' | 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'TOO_MANY_EVENTS' };

/** Fetch a complete account-owned snapshot; partial pages are never admitted. */
export async function fetchServerEvidence(learnerId: string): Promise<ServerEvidenceResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { skipped: 'OFFLINE' };
  }
  const events: LearnerEventRecord[] = [];
  let offset = 0;
  try {
    for (let pageIndex = 0; pageIndex < MAX_EVENT_PAGES; pageIndex += 1) {
      const response = await fetchWithDeadline(`/api/events?offset=${offset}`, {
        credentials: 'include',
        deadlineMs: HYDRATION_DEADLINE_MS,
      });
      if (!response.ok) return { skipped: 'UNAVAILABLE' };
      const parsed = eventPageSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.events.some((event) => event.learnerId !== learnerId)) {
        return { skipped: 'INVALID_RESPONSE' };
      }
      events.push(...parsed.data.events);
      if (parsed.data.nextOffset === null) return { events };
      if (parsed.data.nextOffset <= offset) return { skipped: 'INVALID_RESPONSE' };
      offset = parsed.data.nextOffset;
    }
    return { skipped: 'TOO_MANY_EVENTS' };
  } catch {
    return { skipped: 'UNAVAILABLE' };
  }
}
