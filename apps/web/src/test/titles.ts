import type {
  GroupTitle,
  MediaInfo,
  MemberStatus,
  TitleView,
} from '@watchlist/shared';

export const rick: MediaInfo = {
  source: 'YOUTUBE',
  externalId: 'dQw4w9WgXcQ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  author: 'Rick Astley',
  durationSec: 213,
};

export function media(n: number): MediaInfo {
  return {
    ...rick,
    externalId: `video${n}`,
    url: `https://www.youtube.com/watch?v=video${n}`,
    title: `Vidéo ${n}`,
  };
}

/**
 * Titre de test vu par Adrien (u1), avec Camille (u2). `view` est celle que
 * renverrait l'API pour ces avis.
 */
export function titleOf(
  m: MediaInfo,
  {
    id = 't1',
    mine = 'OK_ALONE',
    theirs = 'OK_ALONE',
    view = 'ALONE',
    watchedTogetherAt = null,
    myWatchedAloneAt = null,
  }: {
    id?: string;
    mine?: MemberStatus;
    theirs?: MemberStatus;
    view?: TitleView;
    watchedTogetherAt?: string | null;
    myWatchedAloneAt?: string | null;
  } = {},
): GroupTitle {
  return {
    id,
    media: m,
    addedAt: '2026-11-22T21:00:00.000Z',
    addedBy: { userId: 'u1', displayName: 'Adrien', formerMember: false },
    myStatus: mine,
    myWatchedAloneAt,
    watchedTogetherAt,
    members: [
      {
        userId: 'u1',
        displayName: 'Adrien',
        status: mine,
        watchedAloneAt: myWatchedAloneAt,
      },
      {
        userId: 'u2',
        displayName: 'Camille',
        status: theirs,
        watchedAloneAt: null,
      },
    ],
    view,
  };
}
