import { createHash, randomBytes } from 'node:crypto';

/** Jeton opaque de 256 bits, sûr dans une URL. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash stocké en base à la place du jeton. Un SHA-256 suffit : le jeton est
 * aléatoire et long, contrairement à un mot de passe, donc impossible à deviner.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
