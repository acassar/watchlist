import { randomInt } from 'node:crypto';
import {
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
} from '@watchlist/shared';

/** Code court et aléatoire (tirage cryptographique, sans biais de modulo). */
export function generateInvitationCode(): string {
  let code = '';
  for (let i = 0; i < INVITATION_CODE_LENGTH; i++) {
    code +=
      INVITATION_CODE_ALPHABET[randomInt(INVITATION_CODE_ALPHABET.length)];
  }
  return code;
}
