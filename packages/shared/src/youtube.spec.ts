import { findSharedLink, parseYouTubeVideoId } from './index.js';

describe('liens partagés', () => {
  const id = 'dQw4w9WgXcQ';

  it("trouve le lien YouTube dans le texte quand l'URL est vide (app YouTube)", () => {
    expect(
      findSharedLink([
        'Ma vidéo',
        `Regarde ça https://youtu.be/${id}?si=x`,
        '',
      ]),
    ).toBe(`https://youtu.be/${id}?si=x`);
  });

  it('préfère un lien YouTube à un autre lien, quel que soit le champ', () => {
    expect(
      findSharedLink([
        'https://exemple.fr/article',
        `Vu sur https://exemple.fr puis https://www.youtube.com/watch?v=${id}.`,
        undefined,
      ]),
    ).toBe(`https://www.youtube.com/watch?v=${id}`);
  });

  it("se rabat sur la première URL s'il n'y a pas de lien YouTube", () => {
    expect(findSharedLink([null, 'https://vimeo.com/123', undefined])).toBe(
      'https://vimeo.com/123',
    );
  });

  it('renvoie null sans aucune URL', () => {
    expect(findSharedLink(['Juste du texte', '', null])).toBeNull();
  });

  it("lit l'id d'une vidéo", () => {
    expect(parseYouTubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(parseYouTubeVideoId('https://youtu.be/court')).toBeNull();
  });
});
