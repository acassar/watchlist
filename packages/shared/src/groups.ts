import { z } from 'zod';
import type { GroupRole } from './enums.js';

/**
 * Contrats des groupes et des invitations, partagés par le front et l'API.
 * Messages d'erreur = clés i18n (`validation.*`), comme pour l'auth.
 */

export const GROUP_NAME_MAX_LENGTH = 50;
/** Assez pour une bande d'amis ou une coloc, assez peu pour garder les vues lisibles. */
export const GROUP_MAX_MEMBERS = 20;
/** Invitations encore utilisables par groupe : au-delà, il faut en révoquer. */
export const GROUP_MAX_ACTIVE_INVITATIONS = 20;
/**
 * Groupes par utilisateur, créés ou rejoints. Un seul pour l'instant : la
 * limite pourra monter si l'app prend et que la demande arrive. Ceux qui sont
 * déjà dans plusieurs groupes les gardent.
 */
export const USER_MAX_GROUPS = 1;
export const INVITATION_DEFAULT_TTL_DAYS = 7;
export const INVITATION_MAX_TTL_DAYS = 30;

/**
 * Alphabet des codes d'invitation : majuscules et chiffres sans les caractères
 * qu'on confond à l'oral ou à l'écrit (0/O, 1/I/L). 31 symboles : 8 caractères ≈ 40 bits, hors de portée
 * d'un essai au hasard avec le rate limiting de l'API.
 */
export const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITATION_CODE_LENGTH = 8;

export const groupNameSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .min(1, { error: 'validation.required' })
  .max(GROUP_NAME_MAX_LENGTH, { error: 'validation.groupNameTooLong' });

export const groupRequestSchema = z.object({ name: groupNameSchema });
export type GroupRequest = z.infer<typeof groupRequestSchema>;

export const createInvitationRequestSchema = z.object({
  /** Durée de validité en jours (7 par défaut). */
  expiresInDays: z
    .number({ error: 'validation.invalid' })
    .int({ error: 'validation.invalid' })
    .min(1, { error: 'validation.invalid' })
    .max(INVITATION_MAX_TTL_DAYS, { error: 'validation.invalid' })
    .default(INVITATION_DEFAULT_TTL_DAYS),
  /** Nombre d'utilisations autorisées ; absent = illimité jusqu'à expiration. */
  maxUses: z
    .number({ error: 'validation.invalid' })
    .int({ error: 'validation.invalid' })
    .min(1, { error: 'validation.invalid' })
    .max(GROUP_MAX_MEMBERS, { error: 'validation.invalid' })
    .nullish()
    .transform((value) => value ?? null),
});
export type CreateInvitationRequest = z.input<
  typeof createInvitationRequestSchema
>;

/**
 * Code tel que saisi (« abcd-efgh », « ABCD EFGH ») ramené à sa forme stockée :
 * majuscules, sans séparateurs.
 */
export function normalizeInvitationCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Code affiché en deux blocs, plus facile à dicter : ABCD-EFGH. */
export function formatInvitationCode(code: string): string {
  return code.length === INVITATION_CODE_LENGTH
    ? `${code.slice(0, 4)}-${code.slice(4)}`
    : code;
}

export const invitationCodeSchema = z
  .string({ error: 'validation.required' })
  .transform(normalizeInvitationCode)
  .pipe(
    z
      .string()
      .min(1, { error: 'validation.required' })
      .regex(
        new RegExp(
          `^[${INVITATION_CODE_ALPHABET}]{${INVITATION_CODE_LENGTH}}$`,
        ),
        { error: 'validation.invitationCode' },
      ),
  );

/** Rejoindre ou prévisualiser : par le jeton du lien, ou par le code. */
export const invitationRequestSchema = z.union([
  z.object({
    token: z
      .string({ error: 'validation.required' })
      .min(1, { error: 'validation.required' })
      .max(200, { error: 'validation.invalidToken' }),
  }),
  z.object({ code: invitationCodeSchema }),
]);
export type InvitationRequest = z.input<typeof invitationRequestSchema>;

/** Groupe dans la liste « mes groupes ». */
export interface GroupSummary {
  id: string;
  name: string;
  /** Mon rôle dans ce groupe. */
  role: GroupRole;
  memberCount: number;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupDetail extends GroupSummary {
  createdAt: string;
  /** Propriétaire d'abord, puis par date d'arrivée. */
  members: GroupMember[];
}

/** Invitation encore utilisable, telle que la voient les membres du groupe. */
export interface Invitation {
  id: string;
  /** Code court à dicter, sans séparateur (voir formatInvitationCode). */
  code: string;
  expiresAt: string;
  uses: number;
  maxUses: number | null;
  createdAt: string;
  /** Null si son auteur a quitté le groupe ou supprimé son compte. */
  createdBy: { userId: string; displayName: string } | null;
}

/**
 * Invitation qui vient d'être créée : seul moment où le lien est connu,
 * puisque l'API n'en garde que le hash.
 */
export interface CreatedInvitation extends Invitation {
  url: string;
}

/** Ce qu'on montre avant de rejoindre. */
export interface InvitationPreview {
  groupId: string;
  groupName: string;
  memberCount: number;
  invitedBy: string | null;
  alreadyMember: boolean;
}

export const GroupErrorCode = {
  /** Lien ou code inconnu, expiré, révoqué ou épuisé. */
  INVITATION_INVALID: 'INVITATION_INVALID',
  GROUP_FULL: 'GROUP_FULL',
  TOO_MANY_INVITATIONS: 'TOO_MANY_INVITATIONS',
  /** Action réservée au propriétaire du groupe. */
  OWNER_ONLY: 'OWNER_ONLY',
  /** Pour partir soi-même, c'est « Quitter le groupe ». */
  CANNOT_REMOVE_SELF: 'CANNOT_REMOVE_SELF',
  /** Déjà dans USER_MAX_GROUPS groupes. */
  TOO_MANY_GROUPS: 'TOO_MANY_GROUPS',
} as const;
export type GroupErrorCode =
  (typeof GroupErrorCode)[keyof typeof GroupErrorCode];
