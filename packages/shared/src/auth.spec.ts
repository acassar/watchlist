import {
  emailSchema,
  loginRequestSchema,
  registerRequestSchema,
} from './index.js';

describe('schémas d’authentification', () => {
  it('normalise l’email (espaces, majuscules)', () => {
    expect(emailSchema.parse('  Adrien@Exemple.FR ')).toBe('adrien@exemple.fr');
  });

  it('refuse un email invalide avec une clé i18n', () => {
    const result = emailSchema.safeParse('pas-un-email');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.email');
  });

  it('impose une longueur minimale au mot de passe à l’inscription', () => {
    const result = registerRequestSchema.safeParse({
      email: 'a@b.fr',
      password: 'court',
      displayName: 'Adrien',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'validation.passwordTooShort',
    );
  });

  it('nettoie le nom affiché et refuse un nom vide', () => {
    expect(
      registerRequestSchema.parse({
        email: 'a@b.fr',
        password: 'motdepasse',
        displayName: '  Adrien ',
      }).displayName,
    ).toBe('Adrien');
    expect(
      registerRequestSchema.safeParse({
        email: 'a@b.fr',
        password: 'motdepasse',
        displayName: '   ',
      }).success,
    ).toBe(false);
  });

  it('accepte n’importe quel mot de passe non vide à la connexion', () => {
    expect(
      loginRequestSchema.safeParse({ email: 'a@b.fr', password: 'x' }).success,
    ).toBe(true);
  });
});
