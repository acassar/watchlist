import {
  isArchived,
  titleViewFor,
  TitleView,
  watchedTogetherRequestSchema,
  type MemberStatus,
  type ViewMember,
  type ViewTitle,
} from './index.js';

type Spec = MemberStatus | [MemberStatus, 'vu'];

/** Titre de test : un membre par entrée, `vu` = vu seul. */
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

    // Régression : l'avis d'un membre arrivé après l'ajout était ignoré. Les
    // vues ne connaissent plus la date d'arrivée : tout membre actuel compte.
    it('chaque membre actuel compte, quelle que soit sa date d’arrivée', () => {
      // Diane vient d'arriver et n'a pas encore répondu : on l'attend.
      expect(
        titleViewFor(title({ a: 'OK_ALONE', diane: 'PENDING' }), 'a'),
      ).toBe(TitleView.WAITING);
      // Elle veut le voir ensemble : plus regardable seul.
      expect(
        titleViewFor(title({ a: 'TOGETHER', diane: 'TOGETHER' }), 'a'),
      ).toBe(TitleView.TOGETHER);
      expect(
        titleViewFor(title({ a: 'OK_ALONE', diane: 'TOGETHER' }), 'a'),
      ).toBe(TitleView.TOGETHER);
    });

    it('un membre sans avis empêche l’archivage', () => {
      const t = title({
        a: ['OK_ALONE', 'vu'],
        b: 'NOT_INTERESTED',
        diane: 'PENDING',
      });
      expect(isArchived(t)).toBe(false);
      expect(titleViewFor(t, 'diane')).toBe(TitleView.PENDING);
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

    it('pas d’archivage sans aucun membre', () => {
      expect(isArchived(title({}))).toBe(false);
    });
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
