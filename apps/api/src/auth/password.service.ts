import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Hachage des mots de passe en Argon2id (paramètres par défaut recommandés par l'OWASP). */
@Injectable()
export class PasswordService {
  /** Hash calculé une fois, pour comparer en temps constant quand le compte n'existe pas. */
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(
    passwordHash: string | null,
    password: string,
  ): Promise<boolean> {
    if (!passwordHash) {
      // Même coût qu'une vraie vérification : la durée ne révèle pas si le compte existe.
      this.dummyHash ??= hash('canapact-dummy-password');
      await verify(await this.dummyHash, password);
      return false;
    }
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
