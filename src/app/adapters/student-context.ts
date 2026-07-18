import { useCallback, useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
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

export interface StudentEventsState {
  readonly records: LearnerEventRecord[] | undefined;
  readonly migrationError: boolean;
  readonly retryMigration: () => void;
}

interface PreparationState {
  readonly key: string | null;
  readonly status: 'loading' | 'ready' | 'error';
  readonly records?: LearnerEventRecord[];
}

export function useStudentEvents(context: StudentDiagnosisContext | null): StudentEventsState {
  const learnerId = context?.learnerId;
  const simulationProfileId = context?.simulationProfileId;
  const scopeKey = learnerId ? `${learnerId}:${simulationProfileId ?? 'no-simulation'}` : null;
  const [preparation, setPreparation] = useState<PreparationState>({
    key: null,
    status: 'loading',
  });
  const [migrationAttempt, setMigrationAttempt] = useState(0);
  const retryMigration = useCallback(() => {
    setPreparation({ key: scopeKey, status: 'loading' });
    setMigrationAttempt((attempt) => attempt + 1);
  }, [scopeKey]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    if (!learnerId || !scopeKey) return;
    void (async () => {
      try {
        if (simulationProfileId) {
          await migrateLearnerEvents(simulationProfileId, learnerId);
        }
        if (cancelled) return;
        const subscription = liveQuery(() => listEventsByLearner(learnerId)).subscribe(
          (records) => {
            if (!cancelled) setPreparation({ key: scopeKey, status: 'ready', records });
          },
          () => {
            if (!cancelled) setPreparation({ key: scopeKey, status: 'error' });
          },
        );
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        if (!cancelled) setPreparation({ key: scopeKey, status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [learnerId, migrationAttempt, scopeKey, simulationProfileId]);

  const migrationError = preparation.status === 'error' && preparation.key === scopeKey;
  const records =
    preparation.status === 'ready' && preparation.key === scopeKey
      ? preparation.records
      : undefined;

  return { records, migrationError, retryMigration };
}
