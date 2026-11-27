/**
 * Simule YouTube (oEmbed et API Data v3) en remplaçant le fetch global :
 * l'API Nest ne fait aucun autre appel fetch, et supertest passe par http.
 * Chaque vidéo connue est décrite par son id ; les autres sont introuvables.
 */
export interface FakeVideo {
  title: string;
  channel: string;
  /** Durée ISO 8601, ex. PT3M33S. */
  duration: string;
}

/** Playlist simulée : vidéos dans l'ordre, avec leur date d'ajout. */
export interface FakePlaylist {
  items: { videoId: string; addedAt?: string; private?: boolean }[];
}

export function mockYouTube(
  videos: Record<string, FakeVideo> = {},
  playlists: Record<string, FakePlaylist> = {},
) {
  const state = {
    videos,
    playlists,
    down: false,
    quotaExceeded: false,
    calls: [] as URL[],
  };

  const fetchMock = vi.fn((input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    state.calls.push(url);
    if (state.down) return Promise.reject(new Error('fetch failed'));

    if (url.href.startsWith('https://www.youtube.com/oembed')) {
      const id = new URL(url.searchParams.get('url')!).searchParams.get('v')!;
      const video = state.videos[id];
      return Promise.resolve(
        video
          ? Response.json({ title: video.title, author_name: video.channel })
          : new Response('Not Found', { status: 404 }),
      );
    }
    const api = 'https://www.googleapis.com/youtube/v3/';
    if (url.href.startsWith(api) && state.quotaExceeded) {
      return Promise.resolve(
        Response.json(
          { error: { errors: [{ reason: 'quotaExceeded' }] } },
          { status: 403 },
        ),
      );
    }
    if (url.href.startsWith(`${api}videos`)) {
      const ids = url.searchParams.get('id')!.split(',');
      return Promise.resolve(
        Response.json({
          items: ids.flatMap((id) => {
            const video = state.videos[id];
            return video
              ? [
                  {
                    id,
                    snippet: {
                      title: video.title,
                      channelTitle: video.channel,
                    },
                    contentDetails: { duration: video.duration },
                  },
                ]
              : [];
          }),
        }),
      );
    }
    if (url.href.startsWith(`${api}playlists`)) {
      const id = url.searchParams.get('id')!;
      return Promise.resolve(
        Response.json({ items: state.playlists[id] ? [{ id }] : [] }),
      );
    }
    if (url.href.startsWith(`${api}playlistItems`)) {
      const playlist = state.playlists[url.searchParams.get('playlistId')!];
      if (!playlist) {
        return Promise.resolve(
          Response.json(
            { error: { errors: [{ reason: 'playlistNotFound' }] } },
            { status: 404 },
          ),
        );
      }
      const size = Number(url.searchParams.get('maxResults') ?? 5);
      const start = Number(url.searchParams.get('pageToken') ?? 0);
      const page = playlist.items.slice(start, start + size);
      const next = start + size < playlist.items.length;
      return Promise.resolve(
        Response.json({
          ...(next ? { nextPageToken: String(start + size) } : {}),
          items: page.map((item) => ({
            snippet: {
              publishedAt: item.addedAt ?? '2026-01-01T00:00:00Z',
              resourceId: { videoId: item.videoId },
            },
            status: { privacyStatus: item.private ? 'private' : 'public' },
          })),
        }),
      );
    }
    return Promise.reject(new Error(`fetch inattendu : ${url.href}`));
  });

  vi.stubGlobal('fetch', fetchMock);
  return state;
}
