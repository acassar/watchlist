import { z } from 'zod';
import { emailSchema, PASSWORD_MAX_LENGTH } from './auth.js';
import type { GroupRole, MediaSourceType, MemberStatus } from './enums.js';

/**
 * Contrats du RGPD (étape 9) : export des données et suppression du compte.
 */

/**
 * Suppression du compte. L'adresse retapée évite une suppression par erreur ;
 * le mot de passe (si le compte en a un) prouve que c'est bien la personne,
 * pas quelqu'un qui a trouvé le téléphone déverrouillé.
 */
export const deleteAccountRequestSchema = z.object({
  confirmEmail: emailSchema,
  password: z
    .string()
    .max(PASSWORD_MAX_LENGTH, { error: 'validation.passwordTooLong' })
    .optional(),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export const AccountErrorCode = {
  /** L'adresse retapée ne correspond pas au compte. */
  CONFIRMATION_MISMATCH: 'CONFIRMATION_MISMATCH',
} as const;
export type AccountErrorCode =
  (typeof AccountErrorCode)[keyof typeof AccountErrorCode];

/** Version du format d'export, à incrémenter si sa forme change. */
export const ACCOUNT_EXPORT_VERSION = 1;

/**
 * Export des données (droit d'accès et portabilité, art. 15 et 20 du RGPD) :
 * tout ce que Canapact stocke sur la personne, en JSON lisible. Les secrets
 * (hash du mot de passe, des jetons) n'en font pas partie : ils ne disent rien
 * de la personne et serviraient seulement à un attaquant.
 */
export interface AccountExport {
  format: 'canapact-export';
  version: typeof ACCOUNT_EXPORT_VERSION;
  exportedAt: string;
  account: {
    id: string;
    email: string;
    displayName: string;
    emailVerifiedAt: string | null;
    hasPassword: boolean;
    /** Identifiant du compte Google lié, s'il y en a un. */
    googleId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  /** Sessions ouvertes (une par appareil connecté), encore valides. */
  sessions: {
    createdAt: string;
    expiresAt: string;
    userAgent: string | null;
  }[];
  groups: {
    id: string;
    name: string;
    role: GroupRole;
    joinedAt: string;
    /** Prénoms affichés des autres membres : on les voit dans l'app. */
    otherMembers: string[];
  }[];
  /** Titres que la personne a ajoutés. */
  addedTitles: {
    groupId: string;
    groupName: string;
    title: string;
    url: string;
    source: MediaSourceType;
    addedAt: string;
    watchedTogetherAt: string | null;
  }[];
  /** Ses avis sur les titres de ses groupes. */
  statuses: {
    groupId: string;
    groupName: string;
    title: string;
    url: string;
    status: Exclude<MemberStatus, 'PENDING'>;
    watchedAloneAt: string | null;
    updatedAt: string;
  }[];
  /** Invitations qu'elle a créées. */
  invitations: {
    groupId: string;
    groupName: string;
    code: string;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    uses: number;
    maxUses: number | null;
  }[];
}
