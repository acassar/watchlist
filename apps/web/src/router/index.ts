import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { useAuthStore } from '@/features/auth/store';

declare module 'vue-router' {
  interface RouteMeta {
    /** Accessible sans être connecté. */
    public?: boolean;
    /** Réservé aux visiteurs non connectés (connexion, inscription). */
    guestOnly?: boolean;
    /** `auth` : écran plein, sans barre d'onglets. */
    layout?: 'auth';
  }
}

const authPage = { public: true, layout: 'auth' } as const;
const guestPage = { ...authPage, guestOnly: true } as const;

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
    component: () => import('@/features/auth/pages/EmailLinkPage.vue'),
    props: { kind: 'link' },
    meta: authPage,
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

/** Restaure la session au premier passage, puis protège les pages privées. */
export function installAuthGuard(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    await auth.init();

    if (!to.meta.public && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (to.meta.guestOnly && auth.isAuthenticated) return '/';
    return true;
  });
}

export function createAppRouter(history = createWebHistory()) {
  const router = createRouter({ history, routes });
  installAuthGuard(router);
  return router;
}
