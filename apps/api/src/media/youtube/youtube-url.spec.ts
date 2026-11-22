import { parseIsoDuration, parseYouTubeVideoId } from './youtube-url.js';

describe('parseYouTubeVideoId', () => {
  const id = 'dQw4w9WgXcQ';

  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://www.youtube.com/watch?list=PL123&v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}&feature=share`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abcdef`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}?feature=shared`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `http://WWW.YOUTUBE.COM/watch?v=${id}`,
  ])('reconnaît %s', (url) => {
    expect(parseYouTubeVideoId(url)).toBe(id);
  });

  it.each([
    'pas une url',
    'https://vimeo.com/123456',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/@chaine',
    'https://www.youtube.com/watch?v=trop-court',
    `https://youtube.com.evil.fr/watch?v=${id}`,
    `https://evil.fr/youtu.be/${id}`,
    `javascript:alert(1)//youtu.be/${id}`,
    `ftp://youtu.be/${id}`,
  ])('refuse %s', (url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
  });
});

describe('parseIsoDuration', () => {
  it('convertit les durées de l’API Data', () => {
    expect(parseIsoDuration('PT4M5S')).toBe(245);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT15S')).toBe(15);
    expect(parseIsoDuration('P1DT1S')).toBe(86_401);
  });

  it('renvoie null pour un direct (P0D) ou une valeur illisible', () => {
    expect(parseIsoDuration('P0D')).toBeNull();
    expect(parseIsoDuration('n’importe quoi')).toBeNull();
  });
});
