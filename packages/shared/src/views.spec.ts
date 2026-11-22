import {
  isArchived,
  isCounted,
  titleViewFor,
  TitleView,
  watchedTogetherRequestSchema,
  type MemberStatus,
  type ViewMember,
  type ViewTitle,
} from './index.js';

type Spec = MemberStatus | [MemberStatus, 'vu'] | [MemberStatus, 'nouveau'];

/** Titre de test : un membre par entrée, `vu` = vu seul, `nouveau` = non compté. */
function title(
  members: Record<string, Spec>,
  watchedTogetherAt: string | null = null,
): ViewTitle {
  return {
    watchedTogetherAt,
    members: Object.entries(members).map(([userId, spec]): ViewMember => {
      const [status, flag] = Array.isArray(spec) ? spec : [spec, undefined];
      return {
        userId,
        status,
        watchedAloneAt: flag === 'vu' ? '2026-11-22T21:00:00Z' : null,
        counted: flag !== 'nouveau',
      };
    }),
  };
}

describe('vues', () => {
  describe('à deux', () => {
    it('regardable seul quand l’autre a dit « sans moi, ok »', () => {
      const t = title({ moi: 'OK_ALONE', toi: 'OK_ALONE' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.ALONE);
      expect(titleViewFor(t, 'toi')).toBe(TitleView.ALONE);
    });

    it('regardable seul quand l’autre n’est pas intéressé', () => {
      const t = title({ moi: 'OK_ALONE', toi: 'NOT_INTERESTED' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.ALONE);
      expect(titleViewFor(t, 'toi')).toBe(TitleView.HIDDEN);
    });

    it('à regarder ensemble dès qu’un des deux le veut', () => {
      const t = title({ moi: 'OK_ALONE', toi: 'TOGETHER' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.TOGETHER);
      expect(titleViewFor(t, 'toi')).toBe(TitleView.TOGETHER);
    });

    it('en attente de l’autre, et dans « Mon avis » pour lui', () => {
      const t = title({ moi: 'OK_ALONE', toi: 'PENDING' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.WAITING);
      expect(titleViewFor(t, 'toi')).toBe(TitleView.PENDING);
    });

    it('je veux le voir ensemble mais l’autre n’est pas intéressé : seul', () => {
      const t = title({ moi: 'TOGETHER', toi: 'NOT_INTERESTED' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.ALONE);
    });

    it('je veux le voir ensemble, l’autre n’a pas répondu : ensemble', () => {
      const t = title({ moi: 'TOGETHER', toi: 'PENDING' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.TOGETHER);
    });

    it('« vu seul » ne le retire que de mes listes', () => {
      const t = title({ moi: ['OK_ALONE', 'vu'], toi: 'OK_ALONE' });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.HIDDEN);
      expect(titleViewFor(t, 'toi')).toBe(TitleView.ALONE);
    });

    it('un « ensemble » déjà vu seul ne retient plus personne', () => {
      const t = title({ moi: 'OK_ALONE', toi: ['TOGETHER', 'vu'] });
      expect(titleViewFor(t, 'moi')).toBe(TitleView.ALONE);
    });

    it('vu ensemble : archivé pour les deux', () => {
      const t = title(
        { moi: 'TOGETHER', toi: 'TOGETHER' },
        '2026-11-22T21:00:00Z',
      );
      expect(titleViewFor(t, 'moi')).toBe(TitleView.ARCHIVED);
      expect(titleViewFor(t, 'toi')).toBe(TitleView.ARCHIVED);
    });

    it('archivé automatiquement quand chacun l’a vu seul ou n’est pas intéressé', () => {
      expect(
        isArchived(title({ moi: ['OK_ALONE', 'vu'], toi: 'NOT_INTERESTED' })),
      ).toBe(true);
      expect(
        isArchived(title({ moi: 'NOT_INTERESTED', toi: 'NOT_INTERESTED' })),
      ).toBe(true);
      expect(
        isArchived(title({ moi: ['OK_ALONE', 'vu'], toi: 'PENDING' })),
      ).toBe(false);
      expect(
        isArchived(title({ moi: ['OK_ALONE', 'vu'], toi: 'OK_ALONE' })),
      ).toBe(false);
    });
  });

  describe('à N', () => {
    it('regardable seul seulement quand TOUS les autres sont d’accord', () => {
      const t = title({
        a: 'OK_ALONE',
        b: 'OK_ALONE',
        c: 'NOT_INTERESTED',
        d: 'PENDING',
      });
      expect(titleViewFor(t, 'a')).toBe(TitleView.WAITING);
      expect(
        titleViewFor(
          title({
            a: 'OK_ALONE',
            b: 'OK_ALONE',
            c: 'NOT_INTERESTED',
            d: 'OK_ALONE',
          }),
          'a',
        ),
      ).toBe(TitleView.ALONE);
    });

    it('un « ensemble » l’emporte sur une absence de réponse', () => {
      const t = title({ a: 'OK_ALONE', b: 'TOGETHER', c: 'PENDING' });
      expect(titleViewFor(t, 'a')).toBe(TitleView.TOGETHER);
      expect(titleViewFor(t, 'c')).toBe(TitleView.PENDING);
    });

    it('un nouveau membre sans avis ne bloque pas les anciens titres', () => {
      const t = title({
        a: 'OK_ALONE',
        b: 'OK_ALONE',
        nouveau: ['PENDING', 'nouveau'],
      });
      expect(titleViewFor(t, 'a')).toBe(TitleView.ALONE);
      // … mais peut quand même donner son avis.
      expect(titleViewFor(t, 'nouveau')).toBe(TitleView.PENDING);
    });

    it('un nouveau membre sans avis n’empêche pas l’archivage', () => {
      const t = title({
        a: ['OK_ALONE', 'vu'],
        b: 'NOT_INTERESTED',
        nouveau: ['PENDING', 'nouveau'],
      });
      expect(isArchived(t)).toBe(true);
    });
  });

  describe('seul dans le groupe', () => {
    it('tout est regardable seul, même « ensemble »', () => {
      expect(titleViewFor(title({ moi: 'OK_ALONE' }), 'moi')).toBe(
        TitleView.ALONE,
      );
      expect(titleViewFor(title({ moi: 'TOGETHER' }), 'moi')).toBe(
        TitleView.ALONE,
      );
    });

    it('pas d’archivage sans aucun membre compté', () => {
      expect(isArchived(title({ nouveau: ['PENDING', 'nouveau'] }))).toBe(
        false,
      );
    });
  });

  it('compte un membre arrivé avant l’ajout, ou arrivé après avec un avis', () => {
    const added = '2026-11-22T20:00:00Z';
    expect(isCounted('2026-11-01T00:00:00Z', added, 'PENDING')).toBe(true);
    expect(isCounted(added, added, 'PENDING')).toBe(true);
    expect(isCounted('2026-11-22T21:00:00Z', added, 'PENDING')).toBe(false);
    expect(isCounted('2026-11-22T21:00:00Z', added, 'TOGETHER')).toBe(true);
  });

  it('refuse une date « vu ensemble » dans le futur', () => {
    expect(watchedTogetherRequestSchema.parse({})).toEqual({});
    expect(
      watchedTogetherRequestSchema.safeParse({
        watchedAt: '2026-11-21T21:00:00+01:00',
      }).success,
    ).toBe(true);
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(
      watchedTogetherRequestSchema.safeParse({ watchedAt: future }).error
        ?.issues[0]?.message,
    ).toBe('validation.dateInFuture');
  });
});
