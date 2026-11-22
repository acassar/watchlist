import { MediaSourceType, WatchStatus } from './index.js';

describe('enums partagés', () => {
  it('expose les trois avis possibles', () => {
    expect(Object.values(WatchStatus)).toEqual([
      'OK_ALONE',
      'TOGETHER',
      'NOT_INTERESTED',
    ]);
  });

  it('prévoit plusieurs sources de titres', () => {
    expect(Object.values(MediaSourceType)).toContain('YOUTUBE');
  });
});
