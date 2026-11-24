/**
 * Dons : un simple lien sortant vers Liberapay, sans widget ni traceur.
 *
 * Identifiant public de la page Liberapay (la fin de liberapay.com/…).
 * Tant qu'il est vide, le lien de don n'apparaît nulle part.
 */
export const LIBERAPAY_USERNAME = '';

/** Adresse de la page de don, ou `null` si aucun compte n'est configuré. */
export function donationUrl(
  username: string = LIBERAPAY_USERNAME,
): string | null {
  const name = username.trim();
  if (!name) return null;
  return `https://liberapay.com/${encodeURIComponent(name)}/donate`;
}
