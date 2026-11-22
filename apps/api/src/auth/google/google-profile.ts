import type { Profile } from 'passport-google-oauth20';

/** Ce que Canapact retient d'un compte Google, quel que soit le chemin (OIDC, tests). */
export interface GoogleProfile {
  /** Identifiant Google stable (`sub`), jamais réattribué. */
  sub: string;
  /** Adresse en minuscules, ou null si Google n'en fournit pas. */
  email: string | null;
  /** Google garantit que ce compte Google contrôle cette adresse. */
  emailVerified: boolean;
  /** Nom affiché proposé par Google, ou null. */
  name: string | null;
}

export function toGoogleProfile(profile: Profile): GoogleProfile {
  // `_json` est la réponse brute de l'endpoint userinfo d'OpenID Connect.
  const json = profile._json as {
    email?: string;
    email_verified?: boolean | string;
    name?: string;
  };
  const email = json.email ?? profile.emails?.[0]?.value ?? null;
  return {
    sub: profile.id,
    email: email ? email.trim().toLowerCase() : null,
    // Google renvoie un booléen, d'anciennes versions renvoyaient la chaîne "true".
    emailVerified:
      json.email_verified === true || json.email_verified === 'true',
    name: json.name ?? profile.displayName ?? null,
  };
}
