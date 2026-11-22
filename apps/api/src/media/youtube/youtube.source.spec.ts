import { MediaNotFoundError, MediaUnavailableError } from '../media-source.js';
import { YouTubeSource } from './youtube.source.js';

const ID = 'dQw4w9WgXcQ';
const URL_ = `https://youtu.be/${ID}?si=partage`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const oEmbedOk = json(200, {
  title: 'Never Gonna Give You Up',
  author_name: 'Rick Astley',
  thumbnail_url: 'https://evil.example/pas-celle-la.jpg',
});
const videosOk = json(200, {
  items: [
    {
      snippet: { title: 'Titre API', channelTitle: 'Chaîne API' },
      contentDetails: { duration: 'PT3M33S' },
    },
  ],
});

/** fetch simulé : une réponse (ou une erreur) par service. */
function fakeFetch(replies: {
  oembed?: Response | Error;
  videos?: Response | Error;
}) {
  return vi.fn((input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString();
    const reply = url.startsWith('https://www.youtube.com/oembed')
      ? replies.oembed
      : url.startsWith('https://www.googleapis.com/youtube/v3/videos')
        ? replies.videos
        : undefined;
    if (!reply) return Promise.reject(new Error(`fetch inattendu : ${url}`));
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve(reply.clone());
  });
}

describe('YouTubeSource', () => {
  it('reconnaît les liens YouTube seulement', () => {
    const source = new YouTubeSource(undefined, fakeFetch({}));
    expect(source.canHandle(URL_)).toBe(true);
    expect(source.extractId(URL_)).toBe(ID);
    expect(source.canHandle('https://vimeo.com/1')).toBe(false);
  });

  it('combine oEmbed (titre, chaîne) et l’API Data (durée)', async () => {
    const fetchFn = fakeFetch({ oembed: oEmbedOk, videos: videosOk });
    const source = new YouTubeSource('cle-api', fetchFn);

    await expect(source.resolve(URL_)).resolves.toEqual({
      source: 'YOUTUBE',
      externalId: ID,
      url: `https://www.youtube.com/watch?v=${ID}`,
      title: 'Never Gonna Give You Up',
      author: 'Rick Astley',
      // Construite à partir de l'id, pas reprise de la réponse.
      thumbnailUrl: `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`,
      durationSec: 213,
    });

    const urls = fetchFn.mock.calls.map(([u]) => new URL(u as string));
    const oembed = urls.find((u) => u.pathname === '/oembed')!;
    expect(oembed.searchParams.get('url')).toBe(
      `https://www.youtube.com/watch?v=${ID}`,
    );
    const videos = urls.find((u) => u.pathname.endsWith('/videos'))!;
    expect(videos.searchParams.get('id')).toBe(ID);
    expect(videos.searchParams.get('key')).toBe('cle-api');
  });

  it('sans clé API : n’appelle que oEmbed, durée inconnue', async () => {
    const fetchFn = fakeFetch({ oembed: oEmbedOk });
    const source = new YouTubeSource(undefined, fetchFn);

    const media = await source.resolve(URL_);
    expect(media.title).toBe('Never Gonna Give You Up');
    expect(media.durationSec).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('continue sans durée si l’API Data échoue (quota, clé invalide)', async () => {
    const source = new YouTubeSource(
      'cle-api',
      fakeFetch({
        oembed: oEmbedOk,
        videos: json(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }),
      }),
    );
    const media = await source.resolve(URL_);
    expect(media.title).toBe('Never Gonna Give You Up');
    expect(media.durationSec).toBeNull();
  });

  it('se rabat sur l’API Data quand oEmbed refuse (intégration désactivée)', async () => {
    const source = new YouTubeSource(
      'cle-api',
      fakeFetch({
        oembed: new Response('Unauthorized', { status: 401 }),
        videos: videosOk,
      }),
    );
    await expect(source.resolve(URL_)).resolves.toMatchObject({
      title: 'Titre API',
      author: 'Chaîne API',
      durationSec: 213,
    });
  });

  it('lève MediaNotFoundError pour une vidéo inexistante ou privée', async () => {
    const withoutKey = new YouTubeSource(
      undefined,
      fakeFetch({ oembed: new Response('Not Found', { status: 404 }) }),
    );
    await expect(withoutKey.resolve(URL_)).rejects.toBeInstanceOf(
      MediaNotFoundError,
    );

    const withKey = new YouTubeSource(
      'cle-api',
      fakeFetch({
        oembed: new Response('Forbidden', { status: 403 }),
        videos: json(200, { items: [] }),
      }),
    );
    await expect(withKey.resolve(URL_)).rejects.toBeInstanceOf(
      MediaNotFoundError,
    );
  });

  it('lève MediaUnavailableError si YouTube ne répond pas', async () => {
    const down = new YouTubeSource(
      undefined,
      fakeFetch({ oembed: new Error('fetch failed') }),
    );
    await expect(down.resolve(URL_)).rejects.toBeInstanceOf(
      MediaUnavailableError,
    );

    const error500 = new YouTubeSource(
      'cle-api',
      fakeFetch({
        oembed: new Response('oops', { status: 500 }),
        videos: new Error('timeout'),
      }),
    );
    await expect(error500.resolve(URL_)).rejects.toBeInstanceOf(
      MediaUnavailableError,
    );
  });

  it('refuse une réponse oEmbed mal formée', async () => {
    const source = new YouTubeSource(
      undefined,
      fakeFetch({ oembed: json(200, { title: '' }) }),
    );
    await expect(source.resolve(URL_)).rejects.toBeInstanceOf(
      MediaUnavailableError,
    );
  });
});
