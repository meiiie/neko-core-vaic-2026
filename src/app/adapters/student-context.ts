import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Account } from '../session';
import type { LearnerEventRecord } from '../../storage/db';
import { listEventsByLearner, migrateLearnerEvents } from '../../storage/event-repository';
import { isHeroLearnerId, type StudentDiagnosisContext } from './hero-tutor';

export function studentContextForAccount(account: Account | null): StudentDiagnosisContext | null {
  if (!account || account.role !== 'STUDENT' || !account.learnerId) return null;
  const profileId = account.simulationProfileId;
  return {
    learnerId: account.learnerId,
    ...(isHeroLearnerId(profileId) ? { simulationProfileId: profileId } : {}),
  };
}

export function useStudentEvents(
  context: StudentDiagnosisContext | null,
): LearnerEventRecord[] | undefined {
  const learnerId = context?.learnerId;
  const simulationProfileId = context?.simulationProfileId;
  const scopeKey = learnerId ? `${learnerId}:${simulationProfileId ?? 'no-simulation'}` : null;
  const [preparedKey, setPreparedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!learnerId || !scopeKey) return;
    void (async () => {
      if (simulationProfileId) {
        await migrateLearnerEvents(simulationProfileId, learnerId);
      }
      if (!cancelled) setPreparedKey(scopeKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId, scopeKey, simulationProfileId]);

  return useLiveQuery(
    () =>
      learnerId && preparedKey === scopeKey
        ? listEventsByLearner(learnerId)
        : Promise.resolve(undefined),
    [learnerId, preparedKey, scopeKey],
  );
}
