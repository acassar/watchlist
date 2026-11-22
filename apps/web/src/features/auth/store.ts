import type {
  AuthProviders,
  AuthResponse,
  AuthUser,
  LoginRequest,
} from '@watchlist/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiRequestError, setAuthHooks } from '@/api/http';
import { authApi } from './api';

/** Verrou partagé entre onglets : un seul refresh à la fois, sinon la rotation croirait à un vol. */
const REFRESH_LOCK = 'canapact-refresh';

/**
 * Session côté front. Le JWT d'accès (15 min) reste en mémoire, jamais en
 * localStorage ; au rechargement, la session est retrouvée grâce au cookie de
 * refresh httpOnly.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  /** `unknown` tant que la session n'a pas été restaurée au démarrage. */
  const status = ref<'unknown' | 'authenticated' | 'anonymous'>('unknown');
  const isAuthenticated = computed(() => status.value === 'authenticated');

  /** Moyens de connexion activés côté serveur (bouton Google). */
  const providers = ref<AuthProviders | null>(null);
  let providersPromise: Promise<AuthProviders> | null = null;

  let initPromise: Promise<void> | null = null;
  let refreshPromise: Promise<boolean> | null = null;

  function applySession(session: AuthResponse) {
    accessToken.value = session.accessToken;
    user.value = session.user;
    status.value = 'authenticated';
  }

  function clearSession() {
    accessToken.value = null;
    user.value = null;
    status.value = 'anonymous';
  }

  async function doRefresh(): Promise<boolean> {
    try {
      applySession(await authApi.refresh());
      return true;
    } catch (error) {
      // Erreur réseau : on garde l'état actuel plutôt que de déconnecter à tort.
      if (error instanceof ApiRequestError && error.status === 401) {
        clearSession();
      } else if (status.value === 'unknown') {
        clearSession();
      }
      return false;
    }
  }

  /** Un seul refresh en vol par onglet, et sérialisé entre onglets quand le navigateur le permet. */
  function refresh(): Promise<boolean> {
    refreshPromise ??= (
      typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(REFRESH_LOCK, doRefresh)
        : doRefresh()
    ).finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  /** Restaure la session au démarrage (une seule fois). */
  function init(): Promise<void> {
    initPromise ??= refresh().then(() => undefined);
    return initPromise;
  }

  /** Charge une fois les moyens de connexion ; en cas d'erreur, Google reste masqué. */
  function loadProviders(): Promise<AuthProviders> {
    providersPromise ??= authApi
      .providers()
      .catch(() => ({ google: false }))
      .then((value) => (providers.value = value));
    return providersPromise;
  }

  async function login(credentials: LoginRequest) {
    applySession(await authApi.login(credentials));
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }

  setAuthHooks({ getAccessToken: () => accessToken.value, refresh });

  return {
    user,
    accessToken,
    status,
    isAuthenticated,
    init,
    refresh,
    providers,
    loadProviders,
    login,
    logout,
    applySession,
    clearSession,
  };
});
