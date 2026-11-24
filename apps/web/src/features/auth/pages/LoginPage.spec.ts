import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';

async function mountLogin(path = '/login') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
    attachTo: document.body,
  });
  await flushPromises();
  return { wrapper, router };
}

async function fillAndSubmit(
  wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper'],
) {
  await wrapper.find('input[type="email"]').setValue('Adrien@Exemple.fr');
  await wrapper
    .find('input[autocomplete="current-password"]')
    .setValue('secret');
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('connecte puis renvoie vers la page demandée', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [[401, { code: 'UNAUTHENTICATED' }]],
      '/api/auth/login': [[200, { accessToken: 'jwt', user: fakeUser }]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper, router } = await mountLogin('/login?redirect=/pending');

    await fillAndSubmit(wrapper);

    const [, init] = fetchMock.mock.calls.find(
      ([url]) => url === '/api/auth/login',
    ) as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'adrien@exemple.fr',
      password: 'secret',
    });
    // La page cible est chargée à la demande : on attend la fin de la navigation.
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe('/pending'),
    );
  });

  it('propose de renvoyer le lien si l’adresse n’est pas confirmée', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [[401, { code: 'UNAUTHENTICATED' }]],
        '/api/auth/login': [
          [403, { code: 'EMAIL_NOT_VERIFIED', message: 'x' }],
        ],
      }),
    );
    const { wrapper } = await mountLogin();

    await fillAndSubmit(wrapper);

    expect(wrapper.text()).toContain('pas encore confirmée');
    expect(wrapper.text()).toContain('Renvoyer le lien');
  });

  it('affiche un message clair si les identifiants sont faux', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [[401, { code: 'UNAUTHENTICATED' }]],
        '/api/auth/login': [
          [401, { code: 'INVALID_CREDENTIALS', message: 'x' }],
        ],
      }),
    );
    const { wrapper } = await mountLogin();

    await fillAndSubmit(wrapper);

    expect(wrapper.text()).toContain('Email ou mot de passe incorrect.');
  });

  describe('connexion avec Google', () => {
    const anonymous = { '/api/auth/refresh': [[401, {}]] } as const;

    it('masque le bouton quand Google n’est pas configuré', async () => {
      vi.stubGlobal('fetch', fetchByUrl({ ...anonymous }));
      const { wrapper } = await mountLogin();
      expect(wrapper.find('[data-test="google-login"]').exists()).toBe(false);
    });

    it('envoie vers Google en gardant la page demandée', async () => {
      vi.stubGlobal(
        'fetch',
        fetchByUrl({
          ...anonymous,
          '/api/auth/providers': [[200, { google: true }]],
        }),
      );
      const { wrapper } = await mountLogin('/login?redirect=/together');

      const button = wrapper.find('[data-test="google-login"]');
      expect(button.text()).toContain('Continuer avec Google');
      expect(button.attributes('href')).toBe(
        '/api/auth/google?next=%2Ftogether&locale=fr',
      );
    });

    it('n’envoie jamais vers un autre site après Google', async () => {
      vi.stubGlobal(
        'fetch',
        fetchByUrl({
          ...anonymous,
          '/api/auth/providers': [[200, { google: true }]],
        }),
      );
      const { wrapper } = await mountLogin('/login?redirect=//evil.example');
      expect(
        wrapper.find('[data-test="google-login"]').attributes('href'),
      ).toBe('/api/auth/google?next=%2F&locale=fr');
    });

    it('explique un échec au retour de Google', async () => {
      vi.stubGlobal('fetch', fetchByUrl({ ...anonymous }));
      const { wrapper } = await mountLogin(
        '/login?error=google_account_conflict',
      );
      expect(wrapper.find('[data-test="google-error"]').text()).toContain(
        'déjà liée à un autre compte Google',
      );
    });

    it('ignore un code d’erreur inconnu', async () => {
      vi.stubGlobal('fetch', fetchByUrl({ ...anonymous }));
      const { wrapper } = await mountLogin('/login?error=<script>');
      expect(wrapper.find('[data-test="google-error"]').exists()).toBe(false);
    });
  });
});
