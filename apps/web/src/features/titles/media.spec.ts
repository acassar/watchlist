import { describe, expect, it } from 'vitest';
import { mediaTitle } from './media';

const t = (key: string) => `t:${key}`;

describe('mediaTitle', () => {
  it('affiche le titre stocké', () => {
    expect(mediaTitle({ title: 'Never Gonna Give You Up' }, t)).toBe(
      'Never Gonna Give You Up',
    );
  });

  it('vidéo indisponible : libellé traduit', () => {
    expect(mediaTitle({ title: '', unavailable: true }, t)).toBe(
      't:titles.unavailable',
    );
  });
});
