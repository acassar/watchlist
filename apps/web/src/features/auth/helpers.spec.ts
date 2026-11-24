import { ApiRequestError } from '@/api/http';
import { newPasswordSchema } from '@watchlist/shared';
import { safeRedirect } from './redirect';
import { apiErrorMessage, tokenFromHash, zodRule } from './validation';

describe('helpers d’auth', () => {
  it('n’accepte que des redirections internes', () => {
    expect(safeRedirect('/together')).toBe('/together');
    expect(safeRedirect('//evil.example')).toBe('/');
    expect(safeRedirect('https://evil.example')).toBe('/');
    expect(safeRedirect(undefined)).toBe('/');
  });

  it('lit le jeton dans le fragment du lien', () => {
    expect(tokenFromHash('#token=abc_-1')).toBe('abc_-1');
    expect(tokenFromHash('')).toBeNull();
  });

  it('traduit les erreurs des schémas partagés', () => {
    const rule = zodRule(newPasswordSchema);
    expect(rule('court')).toBe('Au moins 8 caractères.');
    expect(rule('assez-long')).toBe(true);
  });

  it('traduit les codes d’erreur de l’API', () => {
    expect(
      apiErrorMessage(new ApiRequestError(401, 'INVALID_CREDENTIALS', 'x')),
    ).toBe('Email ou mot de passe incorrect.');
    expect(apiErrorMessage(new Error('?'))).toContain('Oups');
  });

  it('suggère Google quand le quota d’emails est épuisé, s’il est proposé', () => {
    const quota = new ApiRequestError(503, 'MAIL_QUOTA_EXCEEDED', 'x');
    expect(apiErrorMessage(quota)).not.toContain('Google');
    expect(apiErrorMessage(quota, { googleAvailable: true })).toContain(
      'continuez avec Google',
    );
  });
});
