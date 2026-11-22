import { ConflictException, Injectable } from '@nestjs/common';
import {
  GROUP_MAX_TITLES,
  TitleErrorCode,
  type GroupTitle,
  type WatchStatus,
} from '@watchlist/shared';
import { Prisma } from '../generated/prisma/client.js';
import { groupNotFound } from '../groups/group-member.guard.js';
import { lockGroup } from '../groups/groups.service.js';
import { MediaService, toMediaInfo } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const titleInclude = (userId: string) =>
  ({
    mediaItem: true,
    addedBy: { select: { id: true, displayName: true } },
    statuses: { where: { userId }, select: { status: true } },
  }) satisfies Prisma.GroupTitleInclude;

type TitleRow = Prisma.GroupTitleGetPayload<{
  include: ReturnType<typeof titleInclude>;
}>;

function toGroupTitle(row: TitleRow): GroupTitle {
  return {
    id: row.id,
    media: toMediaInfo(row.mediaItem),
    addedAt: row.addedAt.toISOString(),
    addedBy: row.addedBy
      ? { userId: row.addedBy.id, displayName: row.addedBy.displayName }
      : null,
    myStatus: row.statuses[0]?.status ?? 'PENDING',
  };
}

@Injectable()
export class TitlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /**
   * Titres actifs du groupe (pas encore vus ensemble), les plus récents
   * d'abord. Les trois vues filtrées arrivent à l'étape 6.
   */
  async list(groupId: string, userId: string): Promise<GroupTitle[]> {
    const rows = await this.prisma.groupTitle.findMany({
      where: { groupId, watchedTogetherAt: null },
      include: titleInclude(userId),
      orderBy: [{ addedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toGroupTitle);
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
      // Relu hors transaction : Prisma lance les jointures de l'include en parallèle,
      // ce que la connexion unique d'une transaction n'aime pas (avertissement de pg).
      const row = await this.prisma.groupTitle.findUniqueOrThrow({
        where: { id: created.id },
        include: titleInclude(userId),
      });
      return toGroupTitle(row);
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
