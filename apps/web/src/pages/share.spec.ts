import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { lastAddGroupMemory, pendingShare } from '@/features/groups/storage';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';
import { rick, titleOf } from '@/test/titles';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;
const anonymous = [401, { code: 'UNAUTHENTICATED' }] as const;
const nousDeux = { id: 'g1', name: 'Nous deux', role: 'OWNER', memberCount: 2 };
const coloc = {
  id: 'g2',
  name: 'Coloc Rivoli',
  role: 'MEMBER',
  memberCount: 3,
};
const LINK = 'https://youtu.be/dQw4w9WgXcQ?si=partage';
const resolveUrl = (url: string) =>
  `/api/media/resolve?${new URLSearchParams({ url })}`;
/** Ce qu'envoie l'app YouTube d'Android : le lien dans `text`, `url` vide. */
const SHARE = `/share?${new URLSearchParams({ title: 'Never Gonna Give You Up', text: `Never Gonna Give You Up ${LINK}` })}`;

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
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
    attachTo: document.body,
  });
  await settle();
  return { wrapper, router };
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

const choices = () =>
  [...document.querySelectorAll('[data-test="group-choice"]')].map((e) =>
    e.textContent?.trim(),
  );

describe('partage Android et page d’ajout', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('trouve le lien dans le texte, demande le groupe (dernier utilisé en tête) et ajoute', async () => {
    lastAddGroupMemory.set(fakeUser.id, 'g1');
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [coloc, nousDeux]]],
      [resolveUrl(LINK)]: [[200, rick]],
      '/api/groups/g1/titles': [[201, titleOf(rick)]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { router } = await mountAt(SHARE);

    // Le partage ne reste pas dans l'adresse.
    expect(router.currentRoute.value.fullPath).toBe('/share');
    expect(el('[data-test="shared-link"]').textContent).toContain(LINK);
    expect(choices()[0]).toContain('Nous deux');
    expect(choices()[1]).toContain('Coloc Rivoli');
    expect(document.querySelector('[data-test="add-fab"]')).toBeNull();

    el('[data-test="group-choice"]').click();
    await settle();
    expect(el('[data-test="add-group"]').textContent).toContain('Nous deux');
    expect(el('[data-test="preview"]').textContent).toContain(
      'Never Gonna Give You Up',
    );

    el('[data-test="add-submit"]').click();
    await settle();
    expect(el('[data-test="share-done"]').textContent).toContain(
      'Ajouté à « Nous deux »',
    );
    expect(pendingShare.get()).toBeNull();
    expect(lastAddGroupMemory.get(fakeUser.id)).toBe('g1');
  });

  it('saute le choix du groupe quand il n’y en a qu’un', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        [resolveUrl(LINK)]: [[200, rick]],
      }),
    );
    await mountAt(SHARE);

    expect(document.querySelector('[data-test="group-choice"]')).toBeNull();
    expect(el('[data-test="add-group"]').textContent).toContain('Nous deux');
    expect(document.querySelector('[data-test="change-group"]')).toBeNull();
    expect(el('[data-test="preview"]').textContent).toContain('Rick Astley');
  });

  it('non connecté : garde le lien pendant la connexion, puis y revient', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [anonymous],
      '/api/groups': [[200, [nousDeux]]],
      [resolveUrl(LINK)]: [[200, rick]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { router } = await mountAt(SHARE);

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/share');
    expect(pendingShare.get()).toBe(LINK);

    // Connexion dans un autre onglet (lien de confirmation) : au prochain
    // passage, connecté, n'importe quelle page ramène au partage.
    document.body.innerHTML = '';
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        [resolveUrl(LINK)]: [[200, rick]],
      }),
    );
    const again = await mountAt('/alone');
    expect(again.router.currentRoute.value.name).toBe('share');
    expect(el('[data-test="preview"]').textContent).toContain('Rick Astley');
  });

  it('sans groupe : propose d’en créer un, le lien attend', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
      }),
    );
    const { router } = await mountAt(SHARE);

    expect(el('[data-test="share-no-group"]').textContent).toContain(
      'Il vous faut un groupe',
    );
    await router.push({ name: 'group-new' });
    expect(router.currentRoute.value.name).toBe('group-new');
    expect(pendingShare.get()).toBe(LINK);
  });

  it('partage sans lien : le dit et propose de coller un lien', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
      }),
    );
    await mountAt('/share?text=Juste%20du%20texte');

    expect(el('[data-test="share-empty"]').textContent).toContain(
      'Aucun lien dans ce partage',
    );
    expect(pendingShare.get()).toBeNull();
  });

  it('fermer abandonne le partage', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux, coloc]]],
        '/api/groups/g1/titles': [[200, []]],
        '/api/groups/g2/titles': [[200, []]],
      }),
    );
    const { router } = await mountAt(SHARE);

    el('[data-test="add-close"]').click();
    await settle();
    expect(pendingShare.get()).toBeNull();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('alone'),
    );
  });

  it('/add (iOS) : choix du groupe puis « Coller le lien »', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn(() => Promise.resolve(LINK)) },
      configurable: true,
    });
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux, coloc]]],
        [resolveUrl(LINK)]: [[200, rick]],
      }),
    );
    await mountAt('/add');

    expect(document.querySelector('[data-test="shared-link"]')).toBeNull();
    // Rien de mémorisé : le groupe actif (le premier par nom) en tête.
    expect(choices()[0]).toContain('Coloc Rivoli');
    (
      document.querySelectorAll('[data-test="group-choice"]')[1] as HTMLElement
    ).click();
    await settle();
    expect(el('[data-test="add-group"]').textContent).toContain('Nous deux');

    el('[data-test="paste"]').click();
    await settle();
    expect(el('[data-test="preview"]').textContent).toContain('Rick Astley');
    Reflect.deleteProperty(navigator, 'clipboard');
  });
});
