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

export function mockYouTube(videos: Record<string, FakeVideo> = {}) {
  const state = { videos, down: false, calls: [] as URL[] };

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
    if (url.href.startsWith('https://www.googleapis.com/youtube/v3/videos')) {
      const video = state.videos[url.searchParams.get('id')!];
      return Promise.resolve(
        Response.json({
          items: video
            ? [
                {
                  snippet: { title: video.title, channelTitle: video.channel },
                  contentDetails: { duration: video.duration },
                },
              ]
            : [],
        }),
      );
    }
    return Promise.reject(new Error(`fetch inattendu : ${url.href}`));
  });

  vi.stubGlobal('fetch', fetchMock);
  return state;
}
