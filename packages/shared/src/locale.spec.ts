import { describe, expect, it } from 'vitest';
import { localeSchema, pickLocale } from './locale.js';

describe('pickLocale', () => {
  it('prend la première langue prise en charge', () => {
    expect(pickLocale(['de-DE', 'en-GB', 'fr'])).toBe('en');
    expect(pickLocale(['fr-CA'])).toBe('fr');
    expect(pickLocale(['EN_us'])).toBe('en');
  });

  it('se replie sur le français', () => {
    expect(pickLocale([])).toBe('fr');
    expect(pickLocale(['de', 'es'])).toBe('fr');
  });
});

describe('localeSchema', () => {
  it('refuse une langue inconnue avec une clé i18n', () => {
    const result = localeSchema.safeParse('de');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('validation.invalidLocale');
  });
});
