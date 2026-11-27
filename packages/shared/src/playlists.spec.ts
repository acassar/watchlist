import { parseYouTubePlaylistId } from './playlists.js';

describe('parseYouTubePlaylistId', () => {
  const id = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';

  it.each([
    `https://www.youtube.com/playlist?list=${id}`,
    `https://youtube.com/playlist?list=${id}&si=partage`,
    `https://m.youtube.com/playlist?list=${id}`,
    `https://music.youtube.com/playlist?list=${id}`,
    `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${id}&index=2`,
  ])('reconnaît %s', (url) => {
    expect(parseYouTubePlaylistId(url)).toEqual({ ok: true, playlistId: id });
  });

  it.each([
    'pas une url',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    `https://evil.fr/playlist?list=${id}`,
    `https://youtube.com.evil.fr/playlist?list=${id}`,
    'https://www.youtube.com/playlist?list=court',
    `ftp://youtube.com/playlist?list=${id}`,
  ])('refuse %s', (url) => {
    expect(parseYouTubePlaylistId(url)).toEqual({
      ok: false,
      reason: 'INVALID_PLAYLIST_URL',
    });
  });

  it.each(['WL', 'LL', 'LM', 'RDdQw4w9WgXcQ'])(
    'signale la liste %s comme illisible sans OAuth',
    (list) => {
      expect(
        parseYouTubePlaylistId(`https://www.youtube.com/playlist?list=${list}`),
      ).toEqual({ ok: false, reason: 'PLAYLIST_NOT_SUPPORTED' });
    },
  );
});
