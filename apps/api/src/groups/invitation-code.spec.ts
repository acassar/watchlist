import { invitationCodeSchema } from '@watchlist/shared';
import { generateInvitationCode } from './invitation-code.js';

describe('generateInvitationCode', () => {
  it('produit des codes valides pour le schéma partagé', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInvitationCode();
      expect(invitationCodeSchema.parse(code)).toBe(code);
    }
  });

  it('ne produit pas deux fois le même code sur un petit échantillon', () => {
    const codes = new Set(
      Array.from({ length: 500 }, () => generateInvitationCode()),
    );
    expect(codes.size).toBe(500);
  });
});
