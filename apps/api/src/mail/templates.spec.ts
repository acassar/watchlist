import { verifyEmailTemplate } from './templates.js';

describe('templates email', () => {
  it('échappe le nom affiché dans le HTML', () => {
    const { html, text } = verifyEmailTemplate(
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
    const { html, text } = verifyEmailTemplate('Adrien', url);
    expect(html).toContain(`href="${url}"`);
    expect(text).toContain(url);
  });
});
