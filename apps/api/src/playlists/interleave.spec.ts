import { interleave } from './playlists.service.js';

describe('interleave', () => {
  it('prend les vidéos à tour de rôle et ignore les doublons', () => {
    const a = (v: string) => ({ videoId: v, ownerId: 'a' });
    const b = (v: string) => ({ videoId: v, ownerId: 'b' });
    expect(
      interleave([
        [a('1'), a('2'), a('3')],
        [b('2'), b('4')],
      ]),
    ).toEqual([a('1'), b('2'), b('4'), a('3')]);
    expect(interleave([])).toEqual([]);
  });
});
