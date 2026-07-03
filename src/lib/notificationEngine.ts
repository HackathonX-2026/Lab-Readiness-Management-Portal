import { useEffect, useRef } from 'react';
import { useLabs } from '../state/LabsContext';
import { useNotifications } from '../state/NotificationContext';
import { daysToWorkshop, readinessStatus } from './rules';

/**
 * Simulates Power Automate flows:
 * - Workshop within 15 days with no successful test
 * - Retest required
 * - Test status = Failed
 * - Workshop within 7 days
 * Notifications are generated once per lab per condition per session.
 */
export function useNotificationEngine() {
  const { labs } = useLabs();
  const { push } = useNotifications();
  const emitted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = new Date();
    for (const lab of labs) {
      const dtw = daysToWorkshop(lab, now);
      const status = readinessStatus(lab);

      const check = (key: string, cond: boolean, type: Parameters<typeof push>[0]['type'], msg: string, channels: ('Email' | 'Teams')[]) => {
        const k = `${lab.id}:${key}`;
        if (cond && !emitted.current.has(k)) {
          emitted.current.add(k);
          push({ type, labId: lab.id, message: msg, channel: channels });
        }
      };

      check(
        'w15',
        dtw !== null && dtw >= 0 && dtw <= 15 && lab.testStatus !== 'Passed',
        'workshop-soon',
        `${lab.labName} (${lab.language}) workshop in ${dtw}d — not yet passed`,
        ['Email', 'Teams']
      );
      check(
        'w7',
        dtw !== null && dtw >= 0 && dtw <= 7 && lab.testStatus !== 'Passed',
        'workshop-urgent',
        `URGENT: ${lab.labName} workshop in ${dtw}d`,
        ['Email', 'Teams']
      );
      check(
        'retest',
        status === 'Retest Required',
        'retest',
        `${lab.labName} requires retesting`,
        ['Email']
      );
      check(
        'failed',
        lab.testStatus === 'Failed',
        'failed',
        `${lab.labName} test FAILED — action required`,
        ['Email', 'Teams']
      );
    }
  }, [labs, push]);
}
