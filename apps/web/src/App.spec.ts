import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from './App.vue';
import { i18n } from './plugins/i18n';
import { createAppRouter } from './router';
import { fakeUser, jsonResponse } from './test/setup';

async function mountAt(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('connecté : affiche les trois vues et ouvre « Je peux regarder seul » par défaut', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { accessToken: 'jwt', user: fakeUser }),
        ),
    );
    const { wrapper } = await mountAt('/');

    expect(wrapper.text()).toContain('Seul');
    expect(wrapper.text()).toContain('Ensemble');
    expect(wrapper.text()).toContain('Mon avis');
    expect(wrapper.text()).toContain('Je peux regarder seul');
  });

  it('non connecté : renvoie vers la connexion en gardant la page demandée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'UNAUTHENTICATED' })),
    );
    const { wrapper, router } = await mountAt('/together');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/together');
    expect(wrapper.text()).toContain('Bon retour sur le canapé');
    expect(wrapper.text()).not.toContain('Mon avis');
  });
});
