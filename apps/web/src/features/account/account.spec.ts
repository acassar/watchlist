import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import {
  activeGroupMemory,
  lastAddGroupMemory,
  pendingShare,
} from '@/features/groups/storage';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;
const googleSession = [
  200,
  { accessToken: 'jwt', user: { ...fakeUser, hasPassword: false } },
] as const;
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
  return { router };
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

async function type(selector: string, value: string) {
  const input = el<HTMLInputElement>(`${selector} input`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await settle();
}

function bodyOf(fetchMock: ReturnType<typeof fetchByUrl>, url: string) {
  const call = fetchMock.mock.calls.find(([u]) => u === url) as
    [string, RequestInit] | undefined;
  return call ? (JSON.parse(String(call[1].body)) as unknown) : undefined;
}

describe('réglages du compte', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('s’ouvre depuis le menu du compte', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
      }),
    );
    const { router } = await mountAt('/alone');
    el('[aria-label="Mon compte"]').click();
    await settle();
    el('[data-test="open-settings"]').click();
    await vi.waitFor(() => el('[data-test="settings-user"]'));
    expect(router.currentRoute.value.name).toBe('settings');
  });

  it('télécharge l’export JSON', async () => {
    const data = {
      format: 'canapact-export',
      exportedAt: '2026-11-23T10:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
        '/api/me/export': [[200, data]],
      }),
    );
    const createObjectURL = vi.fn(() => 'blob:export');
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('canapact-export-2026-11-23.json');
        expect(this.href).toBe('blob:export');
      });
    await mountAt('/settings');

    el('[data-test="export"]').click();
    await settle();

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('supprime le compte après l’adresse et le mot de passe, puis oublie l’appareil', async () => {
    activeGroupMemory.set(fakeUser.id, 'g1');
    lastAddGroupMemory.set(fakeUser.id, 'g1');
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, []]],
      '/api/me/delete': [[204]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { router } = await mountAt('/settings');

    el('[data-test="delete-account"]').click();
    await settle();
    const submit = () => el<HTMLButtonElement>('[data-test="confirm-delete"]');
    expect(submit().disabled).toBe(true);

    await type('[data-test="confirm-email"]', 'Adrien@exemple.fr');
    expect(submit().disabled).toBe(true);
    await type('[data-test="confirm-password"]', 'canape-du-soir');
    expect(submit().disabled).toBe(false);

    submit().click();
    await settle();
    await vi.waitFor(() => el('[data-test="account-deleted"]'));

    expect(bodyOf(fetchMock, '/api/me/delete')).toEqual({
      confirmEmail: 'adrien@exemple.fr',
      password: 'canape-du-soir',
    });
    expect(router.currentRoute.value.name).toBe('login');
    expect(activeGroupMemory.get(fakeUser.id)).toBeNull();
    expect(lastAddGroupMemory.get(fakeUser.id)).toBeNull();
  });

  it('ne demande pas de mot de passe à un compte Google, et affiche une erreur claire', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [googleSession],
      '/api/groups': [[200, []]],
      '/api/me/delete': [[400, { code: 'CONFIRMATION_MISMATCH', message: '' }]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountAt('/settings');

    el('[data-test="delete-account"]').click();
    await settle();
    expect(document.querySelector('[data-test="confirm-password"]')).toBeNull();
    await type('[data-test="confirm-email"]', 'adrien@exemple.fr');
    el('[data-test="confirm-delete"]').click();
    await settle();

    expect(bodyOf(fetchMock, '/api/me/delete')).toEqual({
      confirmEmail: 'adrien@exemple.fr',
    });
    expect(el('[data-test="delete-dialog"]').textContent).toContain(
      'ne correspond pas',
    );
  });

  it('propose de se reconnecter avec Google quand la connexion est trop ancienne', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [googleSession],
        '/api/groups': [[200, []]],
        '/api/me/delete': [[403, { code: 'REAUTH_REQUIRED', message: '' }]],
      }),
    );
    await mountAt('/settings');

    el('[data-test="delete-account"]').click();
    await settle();
    await type('[data-test="confirm-email"]', 'adrien@exemple.fr');
    el('[data-test="confirm-delete"]').click();
    await settle();

    expect(el('[data-test="reauth-required"]').textContent).toContain(
      'reconnectez-vous avec Google',
    );
    expect(el<HTMLAnchorElement>('[data-test="reauth-google"]').href).toContain(
      '/api/auth/google?next=%2Fsettings',
    );
  });
});

describe('pages légales', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('se lisent sans compte, et l’inscription y renvoie', async () => {
    vi.stubGlobal('fetch', fetchByUrl({ '/api/auth/refresh': [anonymous] }));
    const { router } = await mountAt('/register');

    const links = [...el('[data-test="register-legal"]').querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/legal/terms',
      '/legal/privacy',
    ]);

    await router.push('/legal/privacy');
    await settle();
    expect(router.currentRoute.value.name).toBe('privacy');
    const text = document.body.textContent ?? '';
    expect(text).toContain('Brevo');
    expect(text).toContain("Services d'API YouTube");
    expect(text).toContain('Backblaze');
    // Tous les champs de l'éditeur sont remplis : plus rien « À COMPLÉTER ».
    expect(document.querySelectorAll('[data-test="legal-todo"]')).toHaveLength(
      0,
    );
    const hrefs = [...document.querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toContain('https://www.youtube.com/t/terms');
    expect(hrefs).toContain('https://policies.google.com/privacy');
  });

  it('restent lisibles quand un partage attend d’être ajouté', async () => {
    pendingShare.set('https://youtu.be/dQw4w9WgXcQ');
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
      }),
    );
    const { router } = await mountAt('/legal/terms');
    expect(router.currentRoute.value.name).toBe('terms');
    expect(document.body.textContent).toContain('Bonne conduite');
  });
});
