import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';
import { applyLocale, currentLocale, detectLocale } from './locale';

const anonymous = [401, { code: 'UNAUTHENTICATED' }] as const;

async function settle() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
}

async function mountAt(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
    attachTo: document.body,
  });
  await settle();
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

/** Toutes les clés « a.b.c » d'un fichier de traductions. */
function keys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('langue', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    applyLocale('fr', false);
    localStorage.clear();
  });

  it('a les mêmes clés en français et en anglais', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });

  it('démarre dans la langue retenue, sinon celle du navigateur', () => {
    vi.stubGlobal('navigator', { languages: ['en-GB', 'fr'] });
    expect(detectLocale()).toBe('en');
    vi.stubGlobal('navigator', { languages: ['de-DE'] });
    expect(detectLocale()).toBe('fr');

    localStorage.setItem('canapact.locale', 'en');
    expect(detectLocale()).toBe('en');
  });

  it('bascule l’interface et la retient sur l’appareil', () => {
    applyLocale('en');
    expect(currentLocale.value).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.global.t('nav.together')).toBe('Together');
    expect(localStorage.getItem('canapact.locale')).toBe('en');
  });

  it('se choisit avant connexion, et part avec l’inscription', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [anonymous],
      '/api/auth/register': [[202]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountAt('/register');
    expect(document.body.textContent).toContain('Créer votre compte');

    el('[data-test="language-en"]').click();
    await settle();
    expect(document.body.textContent).toContain('Create your account');
    expect(localStorage.getItem('canapact.locale')).toBe('en');
    // Pas de compte : rien n'est envoyé au serveur.
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
      '/api/me/locale',
    );
  });

  it('prend la langue du compte à la connexion', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [
          [200, { accessToken: 'jwt', user: { ...fakeUser, locale: 'en' } }],
        ],
        '/api/groups': [[200, []]],
      }),
    );
    await mountAt('/alone');
    expect(currentLocale.value).toBe('en');
    expect(document.body.textContent).toContain('Your couch is waiting');
  });

  it('change la langue du compte depuis les réglages', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [[200, { accessToken: 'jwt', user: fakeUser }]],
      '/api/groups': [[200, []]],
      '/api/me/locale': [[200, { ...fakeUser, locale: 'en' }]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountAt('/settings');

    el('[data-test="language-picker"] [data-test="language-en"]').click();
    await settle();

    const call = fetchMock.mock.calls.find(([u]) => u === '/api/me/locale') as
      [string, RequestInit] | undefined;
    expect(call?.[1].method).toBe('PATCH');
    expect(JSON.parse(String(call?.[1].body))).toEqual({ locale: 'en' });
    expect(document.body.textContent).toContain('Settings');
  });

  it('montre les pages légales traduites, en rappelant que le français fait foi', async () => {
    vi.stubGlobal('fetch', fetchByUrl({ '/api/auth/refresh': [anonymous] }));
    applyLocale('en');
    await mountAt('/legal/privacy');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('YouTube API Services'),
    );
    expect(el('[data-test="legal-french-prevails"]').textContent).toContain(
      'the French version prevails',
    );
    expect(document.body.textContent).not.toContain("Services d'API YouTube");

    // Retour au français : la page d'origine, sans bandeau.
    applyLocale('fr');
    await settle();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Services d'API YouTube"),
    );
    expect(
      document.querySelector('[data-test="legal-french-prevails"]'),
    ).toBeNull();
  });

  it.each(['/legal/notice', '/legal/terms'])(
    'traduit aussi %s',
    async (path) => {
      vi.stubGlobal('fetch', fetchByUrl({ '/api/auth/refresh': [anonymous] }));
      applyLocale('en');
      await mountAt(path);
      await vi.waitFor(() =>
        expect(document.body.textContent).toMatch(/Publisher|The service/),
      );
    },
  );
});
