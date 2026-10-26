import { describe, expect, it } from 'vitest';

import { warningsByRegion } from './meteoalarm.ts';
import { alert, feed, NOW_S } from './test-feeds.ts';

describe('MeteoAlarm feed', () => {
  it('reads each warning in force by region, with its level and texts', () => {
    const regions = warningsByRegion(
      feed(alert({ identifier: 'a', region: 'ES521', level: 3 })),
      NOW_S,
    );
    const [warning] = regions.get('ES521') ?? [];
    expect(warning?.level).toBe(3);
    expect(warning?.expires).toBe(NOW_S + 6 * 3600);
    expect(warning?.text.es?.event).toBe('Aviso por lluvias');
    expect(warning?.text.en?.event).toBe('Rain warning');
  });

  it('leaves out expired, cancelled and replaced alerts', () => {
    const regions = warningsByRegion(
      feed(
        alert({ identifier: 'old', region: 'ES521', level: 2 }),
        alert({
          identifier: 'new',
          region: 'ES521',
          level: 4,
          msgType: 'Update',
          references: 'sender,old,2026-10-26T08:00:00Z',
        }),
        alert({ identifier: 'over', region: 'ES522', level: 3, expiresInHours: -1 }),
        alert({ identifier: 'gone', region: 'ES523', level: 3, msgType: 'Cancel' }),
      ),
      NOW_S,
    );
    expect(regions.get('ES521')?.map((warning) => warning.level)).toEqual([4]);
    expect([...regions.keys()]).toEqual(['ES521']);
  });

  it('reads nothing from what is not a feed', () => {
    expect(warningsByRegion('nothing', NOW_S).size).toBe(0);
    expect(warningsByRegion({ warnings: [null, {}] }, NOW_S).size).toBe(0);
  });
});
