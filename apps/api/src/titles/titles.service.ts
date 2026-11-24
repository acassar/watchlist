import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVE_VIEWS,
  GROUP_MAX_ACTIVE_TITLES,
  GROUP_MAX_TITLES,
  isCounted,
  TitleErrorCode,
  titleViewFor,
  WatchStatus,
  type GroupTitle,
  type TitleMember,
} from '@watchlist/shared';
import { Prisma } from '../generated/prisma/client.js';
import { groupNotFound } from '../groups/group-member.guard.js';
import { lockGroup, type Tx } from '../groups/groups.service.js';
import { MediaService, toMediaInfo } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const titleInclude = {
  mediaItem: true,
  addedBy: { select: { id: true, displayName: true } },
  statuses: { select: { userId: true, status: true, watchedAloneAt: true } },
} satisfies Prisma.GroupTitleInclude;

type TitleRow = Prisma.GroupTitleGetPayload<{ include: typeof titleInclude }>;

/** Membre actuel du groupe, tel qu'il sert au calcul des vues. */
interface GroupMemberInfo {
  userId: string;
  joinedAt: Date;
  displayName: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function titleNotFound() {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Ce titre ne fait pas partie du groupe',
  });
}

/**
 * À appeler sous le verrou du groupe avant de remettre un titre en cours
 * (hors verrou : simple pré-contrôle, à refaire ensuite sous verrou).
 */
async function assertActiveRoom(
  tx: Tx | PrismaService,
  groupId: string,
): Promise<void> {
  const active = await tx.groupTitle.count({
    where: { groupId, watchedTogetherAt: null },
  });
  if (active >= GROUP_MAX_ACTIVE_TITLES) {
    throw new ConflictException({
      code: TitleErrorCode.TOO_MANY_ACTIVE_TITLES,
      message: 'Trop de titres en cours dans ce groupe',
    });
  }
}

/**
 * Titre vu par `userId`. Les vues sont calculées par la même fonction pure que
 * le front (shared/views.ts) : à 20 membres et 2 000 titres maximum par
 * groupe, tout tient en mémoire et une seule implémentation fait foi.
 */
function toGroupTitle(
  row: TitleRow,
  members: GroupMemberInfo[],
  userId: string,
): GroupTitle {
  const byUser = new Map(row.statuses.map((s) => [s.userId, s]));
  const titleMembers: TitleMember[] = members.map((m) => {
    const s = byUser.get(m.userId);
    const status = s?.status ?? 'PENDING';
    return {
      userId: m.userId,
      displayName: m.displayName,
      status,
      watchedAloneAt: s?.watchedAloneAt?.toISOString() ?? null,
      counted: isCounted(m.joinedAt, row.addedAt),
    };
  });
  // Moi d'abord, puis par ordre d'arrivée (déjà l'ordre de `members`).
  titleMembers.sort(
    (a, b) => Number(b.userId === userId) - Number(a.userId === userId),
  );
  const me = titleMembers.find((m) => m.userId === userId);
  const watchedTogetherAt = row.watchedTogetherAt?.toISOString() ?? null;

  return {
    id: row.id,
    media: toMediaInfo(row.mediaItem),
    addedAt: row.addedAt.toISOString(),
    addedBy: row.addedBy
      ? {
          userId: row.addedBy.id,
          displayName: row.addedBy.displayName,
          formerMember: !members.some((m) => m.userId === row.addedBy?.id),
        }
      : null,
    myStatus: me?.status ?? 'PENDING',
    myWatchedAloneAt: me?.watchedAloneAt ?? null,
    watchedTogetherAt,
    members: titleMembers,
    view: titleViewFor({ watchedTogetherAt, members: titleMembers }, userId),
  };
}

/** Date qui range un titre dans l'historique : sa sortie de liste la plus récente. */
function historyDate(t: GroupTitle): string {
  const dates = [
    t.watchedTogetherAt,
    ...t.members.map((m) => m.watchedAloneAt),
  ].filter((d): d is string => d !== null);
  return dates.sort().at(-1) ?? t.addedAt;
}

@Injectable()
export class TitlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /**
   * Listes actives du membre (Seul, Ensemble, En attente des autres, Mon avis),
   * les plus récents d'abord. Le front range chaque titre selon `view`.
   */
  async list(groupId: string, userId: string): Promise<GroupTitle[]> {
    const [rows, members] = await Promise.all([
      this.prisma.groupTitle.findMany({
        where: { groupId, watchedTogetherAt: null },
        include: titleInclude,
        orderBy: [{ addedAt: 'desc' }, { id: 'asc' }],
      }),
      this.members(groupId),
    ]);
    return rows
      .map((row) => toGroupTitle(row, members, userId))
      .filter((t) => ACTIVE_VIEWS.includes(t.view));
  }

  /**
   * Historique du membre : vus ensemble, archivés, vus seul, pas pour moi.
   * Le plus récemment sorti d'abord.
   */
  async history(groupId: string, userId: string): Promise<GroupTitle[]> {
    const [rows, members] = await Promise.all([
      this.prisma.groupTitle.findMany({
        where: { groupId },
        include: titleInclude,
      }),
      this.members(groupId),
    ]);
    return rows
      .map((row) => toGroupTitle(row, members, userId))
      .filter((t) => !ACTIVE_VIEWS.includes(t.view))
      .sort((a, b) => historyDate(b).localeCompare(historyDate(a)));
  }

  /** Mon avis sur un titre (le changer est toujours possible). */
  setStatus(
    groupId: string,
    userId: string,
    titleId: string,
    status: WatchStatus,
  ): Promise<GroupTitle> {
    return this.write(groupId, userId, titleId, (tx) =>
      tx.memberStatus.upsert({
        where: { groupTitleId_userId: { groupTitleId: titleId, userId } },
        create: { groupTitleId: titleId, userId, status },
        update: { status },
      }),
    );
  }

  /**
   * « Vu seul » : sort le titre de MES listes. Sans avis donné, on enregistre
   * « sans moi, ok » (je l'ai vu sans les autres, c'est donc que ça m'allait).
   * `watched` à false annule.
   */
  setWatchedAlone(
    groupId: string,
    userId: string,
    titleId: string,
    watched: boolean,
  ): Promise<GroupTitle> {
    const watchedAloneAt = watched ? new Date() : null;
    return this.write(groupId, userId, titleId, async (tx) => {
      if (!watched) {
        await tx.memberStatus.updateMany({
          where: { groupTitleId: titleId, userId },
          data: { watchedAloneAt },
        });
        return;
      }
      await tx.memberStatus.upsert({
        where: { groupTitleId_userId: { groupTitleId: titleId, userId } },
        create: {
          groupTitleId: titleId,
          userId,
          status: WatchStatus.OK_ALONE,
          watchedAloneAt,
        },
        update: { watchedAloneAt },
      });
    });
  }

  /**
   * « Vu ensemble », à une date donnée (maintenant par défaut) : archive le
   * titre pour tout le groupe. `null` annule.
   */
  setWatchedTogether(
    groupId: string,
    userId: string,
    titleId: string,
    watchedAt: Date | null,
  ): Promise<GroupTitle> {
    return this.write(groupId, userId, titleId, async (tx) => {
      // Annuler un « vu ensemble » remet le titre dans la liste en cours :
      // même limite qu'un ajout, sinon on la contournerait.
      if (watchedAt === null) {
        const current = await tx.groupTitle.findUniqueOrThrow({
          where: { id: titleId },
          select: { watchedTogetherAt: true },
        });
        if (current.watchedTogetherAt) await assertActiveRoom(tx, groupId);
      }
      await tx.groupTitle.update({
        where: { id: titleId },
        data: { watchedTogetherAt: watchedAt },
      });
    });
  }

  private async members(groupId: string): Promise<GroupMemberInfo[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: {
        userId: true,
        joinedAt: true,
        user: { select: { displayName: true } },
      },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
    });
    return rows.map((m) => ({
      userId: m.userId,
      joinedAt: m.joinedAt,
      displayName: m.user.displayName,
    }));
  }

  /**
   * Écriture sur un titre du groupe : sous le verrou du groupe, avec
   * l'appartenance relue (le guard a pu passer juste avant un départ, qui
   * supprime les avis du membre). Renvoie le titre à jour, vu par `userId`.
   */
  private async write(
    groupId: string,
    userId: string,
    titleId: string,
    apply: (tx: Tx) => Promise<unknown>,
  ): Promise<GroupTitle> {
    if (!UUID.test(titleId)) throw titleNotFound();
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockGroup(tx, groupId))) throw groupNotFound();
      const member = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { userId: true },
      });
      if (!member) throw groupNotFound();
      const title = await tx.groupTitle.findFirst({
        where: { id: titleId, groupId },
        select: { id: true },
      });
      if (!title) throw titleNotFound();
      await apply(tx);
    });
    return this.get(groupId, userId, titleId);
  }

  /**
   * Un titre vu par `userId`. Relu hors transaction : Prisma lance les
   * jointures de l'include en parallèle, ce que la connexion unique d'une
   * transaction n'aime pas (avertissement de pg).
   */
  private async get(
    groupId: string,
    userId: string,
    titleId: string,
  ): Promise<GroupTitle> {
    const [row, members] = await Promise.all([
      this.prisma.groupTitle.findUniqueOrThrow({
        where: { id: titleId },
        include: titleInclude,
      }),
      this.members(groupId),
    ]);
    return toGroupTitle(row, members, userId);
  }

  /**
   * Ajoute un titre au groupe avec l'avis de celui qui l'ajoute.
   * La résolution (appel réseau) se fait avant la transaction, pour ne pas
   * garder le verrou du groupe pendant l'appel à YouTube.
   */
  async add(
    groupId: string,
    userId: string,
    url: string,
    status: WatchStatus,
  ): Promise<GroupTitle> {
    // Liste pleine : on refuse avant d'interroger YouTube (attente et quota
    // épargnés). Le contrôle est refait sous verrou pour les ajouts simultanés.
    await assertActiveRoom(this.prisma, groupId);
    const mediaItem = await this.media.resolve(url);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Comme pour les invitations : l'appartenance est revérifiée sous le
        // verrou du groupe (le guard a pu passer juste avant un départ).
        if (!(await lockGroup(tx, groupId))) throw groupNotFound();
        const member = await tx.groupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
          select: { userId: true },
        });
        if (!member) throw groupNotFound();

        if (
          (await tx.groupTitle.count({ where: { groupId } })) >=
          GROUP_MAX_TITLES
        ) {
          throw new ConflictException({
            code: TitleErrorCode.TOO_MANY_TITLES,
            message: 'Cette liste est pleine',
          });
        }
        await assertActiveRoom(tx, groupId);

        return tx.groupTitle.create({
          data: {
            groupId,
            mediaItemId: mediaItem.id,
            addedById: userId,
            statuses: { create: { userId, status } },
          },
          select: { id: true },
        });
      });
      return await this.get(groupId, userId, created.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: TitleErrorCode.TITLE_ALREADY_IN_GROUP,
          message: 'Ce titre est déjà dans la liste du groupe',
        });
      }
      throw error;
    }
  }
}
