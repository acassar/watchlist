import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from './App.vue';
import { i18n } from './plugins/i18n';
import { routes } from './router';

// jsdom ne fournit pas ResizeObserver, utilisé par Vuetify.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App', () => {
  it('affiche les trois vues principales et ouvre « Je peux regarder seul » par défaut', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    router.push('/');
    await router.isReady();

    const wrapper = mount(App, {
      global: { plugins: [createPinia(), router, i18n, createVuetify()] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Seul');
    expect(wrapper.text()).toContain('Ensemble');
    expect(wrapper.text()).toContain('À donner');
    expect(wrapper.text()).toContain('Je peux regarder seul');
  });
});
