/**
 * Dons : un simple lien sortant vers Liberapay, sans widget ni traceur.
 *
 * Identifiant Liberapay : pseudo, ou numéro de compte (stable même si le
 * pseudo change ; Liberapay l'attend sous la forme ~1935215).
 * Tant qu'il est vide, le lien de don n'apparaît nulle part.
 */
export const LIBERAPAY_USERNAME = '1935215';

/** Adresse de la page de don, ou `null` si aucun compte n'est configuré. */
export function donationUrl(
  username: string = LIBERAPAY_USERNAME,
): string | null {
  const name = username.trim();
  if (!name) return null;
  const path = /^\d+$/.test(name) ? `~${name}` : encodeURIComponent(name);
  return `https://liberapay.com/${path}/donate`;
}
