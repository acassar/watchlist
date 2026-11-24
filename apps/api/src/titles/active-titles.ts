import { ConflictException } from '@nestjs/common';
import {
  GROUP_MAX_ACTIVE_TITLES,
  isArchived,
  isCounted,
  TitleErrorCode,
} from '@watchlist/shared';
import type { Tx } from '../groups/groups.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type Db = Tx | PrismaService;

/**
 * Titres « en cours » du groupe : ceux qui ne sont pas archivés pour tout le
 * groupe (ni vus ensemble, ni vus seul ou écartés par chaque membre compté).
 * Même règle que les vues (shared/views.ts) : un titre rangé dans l'historique
 * ne prend pas de place. Calcul en mémoire, comme pour les vues.
 */
export async function countActiveTitles(
  db: Db,
  groupId: string,
): Promise<number> {
  // L'une après l'autre : dans une transaction, la connexion est unique.
  const rows = await db.groupTitle.findMany({
    where: { groupId, watchedTogetherAt: null },
    select: {
      addedAt: true,
      statuses: {
        select: { userId: true, status: true, watchedAloneAt: true },
      },
    },
  });
  const members = await db.groupMember.findMany({
    where: { groupId },
    select: { userId: true, joinedAt: true },
  });
  return rows.filter((row) => {
    const byUser = new Map(row.statuses.map((s) => [s.userId, s]));
    return !isArchived({
      watchedTogetherAt: null,
      members: members.map((m) => {
        const s = byUser.get(m.userId);
        return {
          userId: m.userId,
          status: s?.status ?? 'PENDING',
          watchedAloneAt: s?.watchedAloneAt ?? null,
          counted: isCounted(m.joinedAt, row.addedAt),
        };
      }),
    });
  }).length;
}

function tooManyActive() {
  return new ConflictException({
    code: TitleErrorCode.TOO_MANY_ACTIVE_TITLES,
    message: 'Trop de titres en cours dans ce groupe',
  });
}

/**
 * Avant un ajout : refuse quand la liste en cours est pleine. À appeler sous
 * le verrou du groupe (hors verrou : simple pré-contrôle, refait sous verrou).
 */
export async function assertActiveRoom(db: Db, groupId: string): Promise<void> {
  if ((await countActiveTitles(db, groupId)) >= GROUP_MAX_ACTIVE_TITLES) {
    throw tooManyActive();
  }
}

/**
 * Après un changement qui peut remettre un titre en cours (annuler « vu
 * ensemble ») : refuse si la limite est dépassée. La transaction est alors
 * annulée.
 */
export async function assertActiveWithinLimit(
  db: Db,
  groupId: string,
): Promise<void> {
  if ((await countActiveTitles(db, groupId)) > GROUP_MAX_ACTIVE_TITLES) {
    throw tooManyActive();
  }
}
