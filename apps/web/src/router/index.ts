import { createRouter, createWebHistory } from 'vue-router';

export const routes = [
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
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
