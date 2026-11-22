import type { Profile } from 'passport-google-oauth20';
import { displayNameFrom } from './google-auth.service.js';
import { toGoogleProfile } from './google-profile.js';

function profile(json: Record<string, unknown>): Profile {
  return {
    id: 'sub-1',
    displayName: 'Nom Passport',
    provider: 'google',
    profileUrl: '',
    _raw: '',
    _json: json,
  } as unknown as Profile;
}

describe('toGoogleProfile', () => {
  it('lit les champs OpenID et normalise l’adresse', () => {
    expect(
      toGoogleProfile(
        profile({
          email: ' Adrien@Exemple.FR',
          email_verified: true,
          name: 'A',
        }),
      ),
    ).toEqual({
      sub: 'sub-1',
      email: 'adrien@exemple.fr',
      emailVerified: true,
      name: 'A',
    });
  });

  it('accepte email_verified sous forme de chaîne et refuse son absence', () => {
    expect(
      toGoogleProfile(profile({ email: 'a@b.fr', email_verified: 'true' }))
        .emailVerified,
    ).toBe(true);
    expect(toGoogleProfile(profile({ email: 'a@b.fr' })).emailVerified).toBe(
      false,
    );
  });

  it('tolère un profil sans adresse', () => {
    expect(toGoogleProfile(profile({})).email).toBeNull();
  });
});

describe('displayNameFrom', () => {
  const base = { sub: 's', email: 'a@b.fr', emailVerified: true };

  it('prend le nom Google, sinon la partie locale de l’adresse', () => {
    expect(displayNameFrom({ ...base, name: ' Adrien ' }, 'a@b.fr')).toBe(
      'Adrien',
    );
    expect(displayNameFrom({ ...base, name: null }, 'adrien.c@b.fr')).toBe(
      'adrien.c',
    );
  });

  it('respecte la longueur maximale sans couper un emoji', () => {
    const name = `${'a'.repeat(49)}👩‍👩‍👧`;
    expect(displayNameFrom({ ...base, name }, 'a@b.fr')).toBe('a'.repeat(49));
    expect(
      displayNameFrom({ ...base, name: 'b'.repeat(80) }, 'a@b.fr'),
    ).toHaveLength(50);
  });
});
