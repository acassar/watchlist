import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, jsonResponse } from '@/test/setup';

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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'UNAUTHENTICATED' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'jwt', user: fakeUser }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper, router } = await mountLogin('/login?redirect=/pending');

    await fillAndSubmit(wrapper);

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'adrien@exemple.fr',
      password: 'secret',
    });
    expect(router.currentRoute.value.path).toBe('/pending');
  });

  it('propose de renvoyer le lien si l’adresse n’est pas confirmée', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, { code: 'UNAUTHENTICATED' }))
        .mockResolvedValueOnce(
          jsonResponse(403, { code: 'EMAIL_NOT_VERIFIED', message: 'x' }),
        ),
    );
    const { wrapper } = await mountLogin();

    await fillAndSubmit(wrapper);

    expect(wrapper.text()).toContain('pas encore confirmée');
    expect(wrapper.text()).toContain('Renvoyer le lien');
  });

  it('affiche un message clair si les identifiants sont faux', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, { code: 'UNAUTHENTICATED' }))
        .mockResolvedValueOnce(
          jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'x' }),
        ),
    );
    const { wrapper } = await mountLogin();

    await fillAndSubmit(wrapper);

    expect(wrapper.text()).toContain('Email ou mot de passe incorrect.');
  });
});
