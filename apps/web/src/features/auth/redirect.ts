import { safeRedirectPath } from '@watchlist/shared';

/** N'accepte qu'un chemin interne (pas de redirection ouverte vers un autre site). */
export const safeRedirect = safeRedirectPath;
