/**
 * Informations sur l'éditeur et l'hébergeur, affichées dans les pages légales.
 *
 * ⚠️ À COMPLÉTER AVANT LA MISE EN LIGNE. Aucune de ces valeurs ne doit être
 * inventée : chaque champ marqué `TODO` est affiché tel quel, en évidence,
 * tant qu'il n'est pas rempli (voir LegalValue.vue).
 */

/** Préfixe reconnu par les pages légales pour signaler un champ à remplir. */
export const TODO = 'TODO:';

export const publisher = {
  /** Nom et prénom de l'éditeur (personne physique), ou raison sociale. */
  name: `${TODO} nom et prénom de l'éditeur`,
  /**
   * Adresse postale. Un particulier non professionnel peut ne donner que les
   * coordonnées de son hébergeur, à condition de lui avoir communiqué son
   * identité (LCEN, art. 6 III-2).
   */
  address: `${TODO} adresse postale (ou mention d'anonymat LCEN)`,
  /** Adresse de contact affichée (aussi pour les demandes RGPD). */
  email: `${TODO} adresse email de contact`,
  /** Directeur de la publication (souvent l'éditeur lui-même). */
  director: `${TODO} directeur de la publication`,
  /** SIRET, si l'éditeur est une entreprise ou un auto-entrepreneur. Vide sinon. */
  siret: '',
} as const;

export const host = {
  /** Hébergeur du VPS (raison sociale). */
  name: 'Infomaniak Network SA',
  address: 'Rue Eugène-Marziano 25, 1227 Les Acacias (GE), Suisse',
  phone: `${TODO} téléphone de l'hébergeur`,
  /** Pays où se trouvent les serveurs (et donc la base de données). */
  location: 'Suisse',
} as const;

/** Ce qui dépend du déploiement (étape 7), pas du code. */
export const operations = {
  /** Journaux du reverse proxy (IP, date, adresse demandée). 1 an au plus. */
  serverLogsRetention: `${TODO} durée de conservation des journaux du serveur`,
  /** Sauvegardes pg_dump quotidiennes hors du VPS (décision D9). */
  backupsRetention: `${TODO} durée de conservation des sauvegardes`,
  /** Où sont stockées les sauvegardes (prestataire et pays). */
  backupsLocation: `${TODO} prestataire et pays des sauvegardes`,
} as const;

/** Date de dernière mise à jour des textes, affichée en tête de page. */
export const LEGAL_UPDATED_AT = '2026-11-24';

export function isTodo(value: string): boolean {
  return value.startsWith(TODO);
}
