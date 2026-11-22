import {
  createInvitationRequestSchema,
  formatInvitationCode,
  groupRequestSchema,
  invitationRequestSchema,
  normalizeInvitationCode,
} from './index.js';

describe('schémas des groupes', () => {
  it('nettoie le nom du groupe et refuse un nom vide', () => {
    expect(groupRequestSchema.parse({ name: '  Nous deux ' }).name).toBe(
      'Nous deux',
    );
    const result = groupRequestSchema.safeParse({ name: '   ' });
    expect(result.error?.issues[0]?.message).toBe('validation.required');
  });

  it('refuse un nom trop long', () => {
    const result = groupRequestSchema.safeParse({ name: 'x'.repeat(51) });
    expect(result.error?.issues[0]?.message).toBe(
      'validation.groupNameTooLong',
    );
  });

  it('donne 7 jours et un nombre d’utilisations illimité par défaut', () => {
    expect(createInvitationRequestSchema.parse({})).toEqual({
      expiresInDays: 7,
      maxUses: null,
    });
    expect(
      createInvitationRequestSchema.safeParse({ expiresInDays: 31 }).success,
    ).toBe(false);
  });
});

describe('codes d’invitation', () => {
  it('accepte un code tapé en minuscules, avec tiret ou espaces', () => {
    expect(normalizeInvitationCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(invitationRequestSchema.parse({ code: 'abcd efgh' })).toEqual({
      code: 'ABCDEFGH',
    });
  });

  it('refuse un code de mauvaise longueur ou avec des caractères ambigus', () => {
    expect(invitationRequestSchema.safeParse({ code: 'ABC' }).success).toBe(
      false,
    );
    // O et 0 sont exclus de l'alphabet.
    expect(
      invitationRequestSchema.safeParse({ code: 'ABCDEFG0' }).success,
    ).toBe(false);
  });

  it('accepte aussi un jeton de lien', () => {
    expect(invitationRequestSchema.parse({ token: 'abc' })).toEqual({
      token: 'abc',
    });
  });

  it('affiche le code en deux blocs', () => {
    expect(formatInvitationCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });
});
