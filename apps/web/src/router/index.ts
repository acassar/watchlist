import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { findSharedLink } from '@watchlist/shared';
import { useAuthStore } from '@/features/auth/store';
import { pendingInvite, pendingShare } from '@/features/groups/storage';

declare module 'vue-router' {
  interface RouteMeta {
    /** Accessible sans être connecté. */
    public?: boolean;
    /** Réservé aux visiteurs non connectés (connexion, inscription). */
    guestOnly?: boolean;
    /** `auth` : écran plein, sans barre d'onglets. */
    layout?: 'auth';
    /**
     * Page légale : toujours lisible, connecté ou non, même quand une
     * invitation ou un partage attendent.
     */
    legal?: boolean;
  }
}

const authPage = { public: true, layout: 'auth' } as const;
const guestPage = { ...authPage, guestOnly: true } as const;
const legalPage = { ...authPage, legal: true } as const;

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/alone' },
  {
    path: '/alone',
    name: 'alone',
    component: () => import('@/pages/TitleListPage.vue'),
    props: { view: 'alone' },
  },
  {
    path: '/together',
    name: 'together',
    component: () => import('@/pages/TitleListPage.vue'),
    props: { view: 'together' },
  },
  {
    path: '/pending',
    name: 'pending',
    component: () => import('@/pages/TitleListPage.vue'),
    props: { view: 'pending' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/pages/HistoryPage.vue'),
  },
  {
    // Ajout plein écran : choix du groupe puis lien. Raccourci de l'icône,
    // et sur iOS (pas de menu « Partager » vers une PWA) le bouton « Coller le lien ».
    path: '/add',
    name: 'add',
    component: () => import('@/pages/AddPage.vue'),
    meta: { layout: 'auth' },
  },
  {
    // Cible du menu « Partager » d'Android (share_target du manifest). Publique :
    // le lien est mis de côté avant la connexion, puis on revient ici.
    path: '/share',
    name: 'share',
    component: () => import('@/pages/AddPage.vue'),
    props: { shared: true },
    meta: authPage,
    beforeEnter: (to) => {
      const { title, text, url } = to.query;
      if (title === undefined && text === undefined && url === undefined) {
        // Lien mis de côté : il faut un compte pour l'ajouter.
        if (!useAuthStore().isAuthenticated && !to.query.empty) {
          return { name: 'login', query: { redirect: '/share' } };
        }
        return true;
      }
      const field = (v: unknown) => (typeof v === 'string' ? v : null);
      const link = findSharedLink([field(url), field(text), field(title)]);
      if (link) pendingShare.set(link);
      else pendingShare.clear();
      // Le partage ne reste ni dans la barre d'adresse ni dans l'historique.
      return {
        name: 'share',
        query: link ? {} : { empty: '1' },
        replace: true,
      };
    },
  },
  {
    path: '/groups/new',
    name: 'group-new',
    component: () => import('@/features/groups/pages/CreateGroupPage.vue'),
  },
  {
    path: '/groups/:groupId',
    name: 'group',
    component: () => import('@/features/groups/pages/GroupSettingsPage.vue'),
    props: true,
  },
  {
    // Lien d'invitation (#token=…) ou saisie d'un code. Public : un invité
    // sans compte y apprend qu'il doit d'abord se connecter.
    path: '/join',
    name: 'join',
    component: () => import('@/features/groups/pages/JoinGroupPage.vue'),
    meta: authPage,
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/features/account/pages/AccountSettingsPage.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/features/about/pages/AboutPage.vue'),
    // Lisible sans compte, comme les pages légales : crédits YouTube et dons.
    meta: legalPage,
  },
  {
    path: '/legal/notice',
    name: 'legal-notice',
    component: () =>
      import('@/features/legal/components/LocalizedLegalPage.vue'),
    props: { page: 'notice' },
    meta: legalPage,
  },
  {
    path: '/legal/privacy',
    name: 'privacy',
    component: () =>
      import('@/features/legal/components/LocalizedLegalPage.vue'),
    props: { page: 'privacy' },
    meta: legalPage,
  },
  {
    path: '/legal/terms',
    name: 'terms',
    component: () =>
      import('@/features/legal/components/LocalizedLegalPage.vue'),
    props: { page: 'terms' },
    meta: legalPage,
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/features/auth/pages/LoginPage.vue'),
    meta: guestPage,
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/features/auth/pages/RegisterPage.vue'),
    meta: guestPage,
  },
  {
    path: '/check-email',
    name: 'check-email',
    component: () => import('@/features/auth/pages/CheckEmailPage.vue'),
    meta: guestPage,
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/features/auth/pages/ForgotPasswordPage.vue'),
    meta: authPage,
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/features/auth/pages/ResetPasswordPage.vue'),
    meta: authPage,
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/features/auth/pages/EmailLinkPage.vue'),
    props: { kind: 'verify' },
    meta: authPage,
  },
  {
    path: '/link-password',
    name: 'link-password',
    component: () => import('@/features/auth/pages/LinkPasswordPage.vue'),
    meta: authPage,
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

/** Pages accessibles alors qu'un partage attend d'être ajouté. */
const SHARE_DETOURS = new Set(['share', 'join', 'group-new']);

/** Restaure la session au premier passage, puis protège les pages privées. */
export function installAuthGuard(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    await auth.init();

    if (!to.meta.public && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (to.meta.guestOnly && auth.isAuthenticated) return '/';
    if (to.meta.legal) return true;
    // Invitation ouverte avant de se connecter : on y revient une fois connecté.
    if (
      auth.isAuthenticated &&
      to.name !== 'join' &&
      // Un partage qui arrive passe avant : l'invitation attendra la suite.
      to.name !== 'share' &&
      pendingInvite.get()
    ) {
      return { name: 'join' };
    }
    // Partage reçu avant de se connecter : on y revient une fois connecté.
    // Créer ou rejoindre un groupe reste possible (il en faut un pour ajouter).
    if (
      auth.isAuthenticated &&
      !SHARE_DETOURS.has(String(to.name)) &&
      pendingShare.get()
    ) {
      return { name: 'share' };
    }
    return true;
  });
}

const RELOAD_KEY = 'canapact.chunkReload';

/**
 * Recharge la page une seule fois par adresse : si le morceau manque encore
 * après le rechargement (hors ligne, déploiement cassé), on n'entre pas dans
 * une boucle de rechargements ; l'erreur reste visible.
 */
export function reloadOnce(path: string) {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === path) return;
    sessionStorage.setItem(RELOAD_KEY, path);
  } catch {
    // Stockage indisponible : on recharge quand même (au pire une fois de trop).
  }
  window.location.assign(path);
}

export function createAppRouter(history = createWebHistory()) {
  const router = createRouter({ history, routes });
  installAuthGuard(router);
  // Navigation réussie : un futur déploiement pourra de nouveau recharger.
  router.afterEach((_to, _from, failure) => {
    if (failure) return;
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // Rien à faire.
    }
  });
  // Nouvelle version déployée pendant que l'app était ouverte : les morceaux
  // de l'ancienne n'existent plus. On recharge la page demandée.
  router.onError((error, to) => {
    if (
      error instanceof Error &&
      /dynamically imported module|Importing a module script failed/i.test(
        error.message,
      )
    ) {
      reloadOnce(to.fullPath);
    }
  });
  return router;
}
