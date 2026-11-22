import {
  addTitleRequestSchema,
  findFirstUrl,
  formatDuration,
  resolveMediaRequestSchema,
} from './index.js';

describe('titres', () => {
  it('trouve le lien dans un texte partagé', () => {
    expect(findFirstUrl('Regarde ça ! https://youtu.be/dQw4w9WgXcQ.')).toBe(
      'https://youtu.be/dQw4w9WgXcQ',
    );
    expect(
      findFirstUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
    expect(findFirstUrl('pas de lien ici')).toBeNull();
  });

  it('valide une URL et en extrait le lien', () => {
    expect(
      resolveMediaRequestSchema.parse({ url: '  vu sur https://youtu.be/x  ' }),
    ).toEqual({ url: 'https://youtu.be/x' });
    const empty = resolveMediaRequestSchema.safeParse({ url: '  ' });
    expect(empty.error?.issues[0]?.message).toBe('validation.required');
    const text = resolveMediaRequestSchema.safeParse({ url: 'bonjour' });
    expect(text.error?.issues[0]?.message).toBe('validation.mediaUrl');
    const long = resolveMediaRequestSchema.safeParse({
      url: `https://youtu.be/${'x'.repeat(2048)}`,
    });
    expect(long.success).toBe(false);
  });

  it('présélectionne « Sans moi, ok » pour celui qui ajoute', () => {
    expect(addTitleRequestSchema.parse({ url: 'https://youtu.be/x' })).toEqual({
      url: 'https://youtu.be/x',
      status: 'OK_ALONE',
    });
    expect(
      addTitleRequestSchema.parse({
        url: 'https://youtu.be/x',
        status: 'TOGETHER',
      }).status,
    ).toBe('TOGETHER');
    expect(
      addTitleRequestSchema.safeParse({
        url: 'https://youtu.be/x',
        status: 'PENDING',
      }).success,
    ).toBe(false);
  });

  it('formate une durée', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(245)).toBe('4:05');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
});
