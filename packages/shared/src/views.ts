import { z } from 'zod';
import { WatchStatus, type MemberStatus } from './enums.js';

/**
 * Règles métier de l'étape 6 : dans quelle vue un titre apparaît pour un membre.
 * Fonction pure, utilisée par l'API (source de vérité) et par le front (mise à
 * jour optimiste après un swipe), pour 2 comme pour N membres.
 */

/** Où un titre se range pour un membre donné. */
export const TitleView = {
  /** Regardable seul : aucun autre membre compté n'attend ni ne veut le voir avec moi. */
  ALONE: 'ALONE',
  /** Quelqu'un (moi compris) veut le voir ensemble, et il y a quelqu'un avec qui le voir. */
  TOGETHER: 'TOGETHER',
  /** J'ai dit « sans moi, ok », mais un autre membre n'a pas encore répondu. */
  WAITING: 'WAITING',
  /** Je n'ai pas encore donné mon avis (onglet « Mon avis »). */
  PENDING: 'PENDING',
  /** Sorti de MES listes : vu seul, ou pas pour moi. */
  HIDDEN: 'HIDDEN',
  /** Sorti des listes de tout le groupe : vu ensemble, ou archivé automatiquement. */
  ARCHIVED: 'ARCHIVED',
} as const;
export type TitleView = (typeof TitleView)[keyof typeof TitleView];

/** Vues qui forment les listes actives (les autres vont dans l'historique). */
export const ACTIVE_VIEWS: readonly TitleView[] = [
  TitleView.ALONE,
  TitleView.TOGETHER,
  TitleView.WAITING,
  TitleView.PENDING,
];

/** Un membre actuel du groupe, vu depuis un titre. */
export interface ViewMember {
  userId: string;
  /** Avis donné, ou PENDING (pas de ligne en base). */
  status: MemberStatus;
  watchedAloneAt: string | Date | null;
  /**
   * Compte comme contrainte : arrivé avant l'ajout du titre, ou arrivé après
   * mais a donné son avis de lui-même (un avis donné engage, l'absence non).
   */
  counted: boolean;
}

export interface ViewTitle {
  watchedTogetherAt: string | Date | null;
  /** Membres ACTUELS du groupe : les statuts d'un membre parti sont supprimés. */
  members: readonly ViewMember[];
}

/** Calcule `counted` : voir ViewMember. */
export function isCounted(
  joinedAt: string | Date,
  addedAt: string | Date,
  status: MemberStatus,
): boolean {
  return status !== 'PENDING' || new Date(joinedAt) <= new Date(addedAt);
}

/** Ce membre n'a plus rien à voir sur ce titre : il l'a vu seul ou n'est pas intéressé. */
function isDone(m: ViewMember): boolean {
  return m.watchedAloneAt !== null || m.status === WatchStatus.NOT_INTERESTED;
}

/**
 * Archivé pour tout le groupe : vu ensemble, ou chaque membre compté l'a vu
 * seul ou n'est pas intéressé. Il faut au moins un membre compté (sinon, par
 * exemple quand l'auteur part, un titre que personne n'a vu s'archiverait).
 */
export function isArchived(title: ViewTitle): boolean {
  if (title.watchedTogetherAt) return true;
  const counted = title.members.filter((m) => m.counted);
  return counted.length > 0 && counted.every(isDone);
}

/** Vue du titre pour le membre `userId`. */
export function titleViewFor(title: ViewTitle, userId: string): TitleView {
  if (isArchived(title)) return TitleView.ARCHIVED;
  const me = title.members.find((m) => m.userId === userId);
  // Ne devrait pas arriver (seuls les membres lisent la liste) : prudence.
  if (!me) return TitleView.HIDDEN;
  if (isDone(me)) return TitleView.HIDDEN;
  if (me.status === 'PENDING') return TitleView.PENDING;

  // Les autres membres qui comptent encore : comptés, et pas déjà « finis ».
  const others = title.members.filter(
    (m) => m.userId !== userId && m.counted && !isDone(m),
  );
  if (me.status === WatchStatus.TOGETHER) {
    // Je veux le voir ensemble… s'il reste quelqu'un avec qui le voir.
    return others.length > 0 ? TitleView.TOGETHER : TitleView.ALONE;
  }
  // Moi : OK_ALONE.
  if (others.some((m) => m.status === WatchStatus.TOGETHER)) {
    return TitleView.TOGETHER;
  }
  if (others.some((m) => m.status === 'PENDING')) return TitleView.WAITING;
  return TitleView.ALONE;
}

export const setStatusRequestSchema = z.object({
  status: z.enum(WatchStatus, { error: 'validation.invalid' }),
});
export type SetStatusRequest = z.input<typeof setStatusRequestSchema>;

/** « Vu ensemble » : maintenant par défaut, ou une date passée (on l'a vu hier soir). */
export const watchedTogetherRequestSchema = z.object({
  watchedAt: z.iso
    .datetime({ offset: true, error: 'validation.invalid' })
    .optional()
    .refine(
      // Une minute de marge pour les horloges de téléphone un peu en avance.
      (value) => !value || new Date(value).getTime() <= Date.now() + 60_000,
      { error: 'validation.dateInFuture' },
    ),
});
export type WatchedTogetherRequest = z.input<
  typeof watchedTogetherRequestSchema
>;
