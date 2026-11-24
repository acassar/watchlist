import {
  inactivityWarningTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './templates.js';

describe('templates email', () => {
  it('échappe le nom affiché dans le HTML', () => {
    const { html, text } = verifyEmailTemplate(
      'fr',
      '<script>alert(1)</script>',
      'https://canapact.test/verify-email#token=abc',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // La version texte n'interprète rien : le nom reste lisible.
    expect(text).toContain('<script>alert(1)</script>');
  });

  it('met le lien dans le HTML et dans la version texte', () => {
    const url = 'https://canapact.test/verify-email#token=abc';
    const { html, text } = verifyEmailTemplate('fr', 'Adrien', url);
    expect(html).toContain(`href="${url}"`);
    expect(text).toContain(url);
  });

  it('écrit dans la langue du compte', () => {
    const url = 'https://canapact.test/reset-password#token=abc';
    const fr = resetPasswordTemplate('fr', 'Adrien', url);
    const en = resetPasswordTemplate('en', 'Sam', url);

    expect(fr.subject).toBe('Réinitialisez votre mot de passe');
    expect(fr.html).toContain('<html lang="fr">');
    expect(fr.text).toContain('Bonsoir Adrien,');
    expect(fr.text).toContain(`Choisir un nouveau mot de passe : ${url}`);

    expect(en.subject).toBe('Reset your password');
    expect(en.html).toContain('<html lang="en">');
    expect(en.html).toContain('Button not working? Copy this link:');
    expect(en.text).toContain('Good evening Sam,');
    expect(en.text).toContain(`Choose a new password: ${url}`);
  });

  it('date la suppression dans la langue du compte, heure de Paris', () => {
    // 23 h UTC le 23 : déjà le 24 à Paris.
    const at = new Date('2026-12-23T23:30:00Z');
    expect(inactivityWarningTemplate('fr', 'A', at, 'u').subject).toBe(
      'Votre compte Canapact sera supprimé le 24 décembre 2026',
    );
    expect(inactivityWarningTemplate('en', 'A', at, 'u').subject).toBe(
      'Your Canapact account will be deleted on 24 December 2026',
    );
  });
});
