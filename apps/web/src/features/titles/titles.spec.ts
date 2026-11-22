import { flushPromises, mount } from '@vue/test-utils';
import type { GroupTitle, MediaInfo } from '@watchlist/shared';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;
const nousDeux = { id: 'g1', name: 'Nous deux', role: 'OWNER', memberCount: 2 };
const LINK = 'https://youtu.be/dQw4w9WgXcQ?si=partage';
const resolveUrl = (url: string) =>
  `/api/media/resolve?${new URLSearchParams({ url })}`;

const rick: MediaInfo = {
  source: 'YOUTUBE',
  externalId: 'dQw4w9WgXcQ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  author: 'Rick Astley',
  durationSec: 213,
};

function titleOf(media: MediaInfo, id = 't1'): GroupTitle {
  return {
    id,
    media,
    addedAt: '2026-11-22T21:00:00.000Z',
    addedBy: { userId: 'u1', displayName: 'Adrien' },
    myStatus: 'OK_ALONE',
  };
}

async function settle() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
}

async function mountApp() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push('/alone');
  await router.isReady();
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
    attachTo: document.body,
  });
  await settle();
  return wrapper;
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

/** Corps JSON du dernier appel à une URL. */
function sentTo(fetchMock: ReturnType<typeof fetchByUrl>, url: string) {
  const call = fetchMock.mock.calls
    .filter(([u]) => u === url)
    .at(-1) as unknown as [string, RequestInit] | undefined;
  return call ? JSON.parse(call[1].body as string) : undefined;
}

function stubClipboard(readText: () => Promise<string>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: vi.fn(readText) },
    configurable: true,
  });
}

async function openSheet() {
  el('[data-test="add-fab"]').click();
  await settle();
}

describe('ajout d’un titre par lien', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
    document.body.innerHTML = '';
  });

  it('affiche la liste du groupe actif', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        '/api/groups/g1/titles': [[200, [titleOf(rick)]]],
      }),
    );
    const wrapper = await mountApp();

    const row = wrapper.find('[data-test="title-row"]');
    expect(row.text()).toContain('Never Gonna Give You Up');
    expect(row.text()).toContain('Rick Astley · 3:33');
    expect(row.find('img').attributes('src')).toBe(rick.thumbnailUrl);
    expect(row.find('img').attributes('referrerpolicy')).toBe('no-referrer');
  });

  it('colle le lien, montre l’aperçu et ajoute avec « Sans moi, ok » présélectionné', async () => {
    stubClipboard(() => Promise.resolve(`Regarde ça ${LINK}`));
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1/titles': [
        [200, []],
        [201, titleOf(rick)],
      ],
      [resolveUrl(LINK)]: [[200, rick]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = await mountApp();
    expect(wrapper.text()).toContain('Appuyez sur « + »');

    await openSheet();
    expect(el('[data-test="add-sheet"]').textContent).toContain(
      'Dans « Nous deux »',
    );
    expect(el<HTMLButtonElement>('[data-test="add-submit"]').disabled).toBe(
      true,
    );

    el('[data-test="paste"]').click();
    await settle();

    const preview = el('[data-test="preview"]');
    expect(preview.textContent).toContain('Never Gonna Give You Up');
    expect(preview.textContent).toContain('Rick Astley · 3:33');
    expect(
      el('[data-test="status-OK_ALONE"]').getAttribute('aria-checked'),
    ).toBe('true');

    el('[data-test="add-submit"]').click();
    await settle();

    expect(sentTo(fetchMock, '/api/groups/g1/titles')).toEqual({
      url: rick.url,
      status: 'OK_ALONE',
    });
    expect(wrapper.find('[data-test="title-row"]').text()).toContain(
      'Never Gonna Give You Up',
    );
    expect(document.body.textContent).toContain('Ajouté à « Nous deux »');
  });

  it('envoie l’avis choisi', async () => {
    stubClipboard(() => Promise.resolve(LINK));
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1/titles': [
        [200, []],
        [201, { ...titleOf(rick), myStatus: 'TOGETHER' }],
      ],
      [resolveUrl(LINK)]: [[200, rick]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp();
    await openSheet();
    el('[data-test="paste"]').click();
    await settle();

    el('[data-test="status-TOGETHER"]').click();
    await settle();
    el('[data-test="add-submit"]').click();
    await settle();

    expect(sentTo(fetchMock, '/api/groups/g1/titles').status).toBe('TOGETHER');
  });

  it('explique pourquoi un lien est refusé', async () => {
    const vimeo = 'https://vimeo.com/123';
    stubClipboard(() => Promise.resolve(vimeo));
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        '/api/groups/g1/titles': [[200, []]],
        [resolveUrl(vimeo)]: [[400, { code: 'UNSUPPORTED_URL' }]],
      }),
    );
    await mountApp();
    await openSheet();
    el('[data-test="paste"]').click();
    await settle();

    expect(el('[data-test="add-error"]').textContent).toContain(
      'Canapact lit les liens YouTube',
    );
    expect(document.querySelector('[data-test="preview"]')).toBeNull();
  });

  it('signale un titre déjà dans la liste', async () => {
    stubClipboard(() => Promise.resolve(LINK));
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        '/api/groups/g1/titles': [
          [200, []],
          [409, { code: 'TITLE_ALREADY_IN_GROUP' }],
        ],
        [resolveUrl(LINK)]: [[200, rick]],
      }),
    );
    await mountApp();
    await openSheet();
    el('[data-test="paste"]').click();
    await settle();
    el('[data-test="add-submit"]').click();
    await settle();

    expect(el('[data-test="add-error"]').textContent).toContain(
      'Déjà dans la liste',
    );
  });

  it('presse-papiers refusé : invite à coller dans le champ', async () => {
    stubClipboard(() => Promise.reject(new Error('NotAllowedError')));
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1/titles': [[200, []]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp();
    await openSheet();
    el('[data-test="paste"]').click();
    await settle();

    expect(el('[data-test="add-error"]').textContent).toContain(
      'Collez le lien dans le champ',
    );
  });

  it('sans presse-papiers : saisie à la main, et rien n’est demandé sans lien', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1/titles': [[200, []]],
      [resolveUrl(LINK)]: [[200, rick]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp();
    await openSheet();
    expect(document.querySelector('[data-test="paste"]')).toBeNull();

    const input = el<HTMLInputElement>('[data-test="link"] input');
    input.value = 'bonjour';
    input.dispatchEvent(new Event('input'));
    await settle();
    el('[data-test="preview-btn"]').click();
    await settle();
    expect(el('[data-test="add-error"]').textContent).toContain(
      'Collez un lien YouTube',
    );

    input.value = LINK;
    input.dispatchEvent(new Event('input'));
    await settle();
    el('[data-test="preview-btn"]').click();
    await settle();
    expect(el('[data-test="preview"]').textContent).toContain(
      'Never Gonna Give You Up',
    );
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/media')),
    ).toHaveLength(1);
  });

  it('collage direct dans le champ : aperçu une fois le texte inséré', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1/titles': [[200, []]],
      [resolveUrl(LINK)]: [[200, rick]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp();
    await openSheet();

    // Ordre du navigateur : l'événement paste, ses microtâches, puis
    // l'insertion du texte (événement input).
    const input = el<HTMLInputElement>('[data-test="link"] input');
    input.dispatchEvent(new Event('paste', { bubbles: true }));
    for (let i = 0; i < 5; i++) await Promise.resolve();
    input.value = LINK;
    input.dispatchEvent(new Event('input'));
    await settle();

    expect(document.querySelector('[data-test="add-error"]')).toBeNull();
    expect(el('[data-test="preview"]').textContent).toContain(
      'Never Gonna Give You Up',
    );
  });
});
