import { useLiveQuery } from 'dexie-react-hooks';
import { buildHeroClassDashboard, HERO_CLASS_LEARNERS } from '../../content';
import { toHeroClassObservedEvents } from '../../app/adapters/hero-tutor';
import { listAllEvents } from '../../storage/event-repository';
import { listLatestTeacherOverrides } from '../../storage/override-repository';

const sampleDashboard = buildHeroClassDashboard();

export function useTeacherDashboard() {
  return (
    useLiveQuery(async () => {
      const [records, overrides] = await Promise.all([
        listAllEvents(),
        listLatestTeacherOverrides(),
      ]);
      const observedEvents = toHeroClassObservedEvents(
        records.filter((record) => record.kind === 'ANSWER' || record.kind === 'ASSIGNMENT_ANSWER'),
      );
      return {
        dashboard: buildHeroClassDashboard(HERO_CLASS_LEARNERS, observedEvents, overrides),
        overrides,
      };
    }, []) ?? { dashboard: sampleDashboard, overrides: [] }
  );
}
