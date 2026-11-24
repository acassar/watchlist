import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';
import { media, titleOf } from '@/test/titles';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;
const nousDeux = {
  id: 'g1',
  name: 'Nous deux',
  role: 'OWNER',
  memberCount: 2,
  activeTitleCount: 0,
};
const LIST = '/api/groups/g1/titles';

const alone = titleOf(media(1), { id: 'a1' });
const waiting = titleOf(media(2), {
  id: 'w1',
  theirs: 'PENDING',
  view: 'WAITING',
});
const together = titleOf(media(3), {
  id: 'e1',
  theirs: 'TOGETHER',
  view: 'TOGETHER',
});
const pending1 = titleOf(media(4), {
  id: 'p1',
  mine: 'PENDING',
  view: 'PENDING',
});
const pending2 = titleOf(media(5), {
  id: 'p2',
  mine: 'PENDING',
  view: 'PENDING',
});
const all = [alone, waiting, together, pending1, pending2];

async function settle() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
}

let mounted: { unmount(): void } | null = null;

async function mountApp(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
    attachTo: document.body,
  });
  mounted = wrapper;
  await settle();
  await vi.waitFor(() => {
    if (!document.querySelector('h1')) throw new Error('page pas prête');
  });
  await settle();
  return { wrapper, router };
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

const ids = (selector: string) =>
  [...document.querySelectorAll(`${selector} [data-test="title-row"]`)].map(
    (row) => row.getAttribute('data-title'),
  );

function calls(fetchMock: ReturnType<typeof fetchByUrl>, url: string) {
  return (
    fetchMock.mock.calls as unknown as [string, RequestInit | undefined][]
  ).filter(([u]) => u === url);
}

describe('vues, avis et suivi « vu »', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('range les titres par onglet, avec la pastille de « Mon avis »', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        [LIST]: [[200, all]],
      }),
    );
    const { router } = await mountApp('/alone');

    expect(ids('[data-test="titles"]')).toEqual(['a1']);
    expect(ids('[data-test="waiting"]')).toEqual(['w1']);
    expect(el('[data-test="pending-badge"]').textContent).toContain('2');

    await router.push('/together');
    await settle();
    await vi.waitFor(() => expect(ids('[data-test="titles"]')).toEqual(['e1']));
    expect(document.querySelector('[data-test="waiting"]')).toBeNull();
  });

  it('montre les avis de chacun, pastille en pointillés pour qui n’a pas répondu', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        [LIST]: [[200, [waiting]]],
      }),
    );
    await mountApp('/alone');

    const row = el('[data-title="w1"]');
    const dots = [...row.querySelectorAll('[data-status]')].map((d) =>
      d.getAttribute('data-status'),
    );
    expect(dots).toEqual(['OK_ALONE', 'PENDING']);
    expect(
      row.querySelector('[aria-label="Camille : pas encore répondu"]'),
    ).not.toBeNull();
  });

  it('« Mon avis » : tuto au premier usage, puis une carte à la fois', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [LIST]: [
        [200, [pending1, pending2]],
        [200, [{ ...pending1, mine: 'TOGETHER', view: 'TOGETHER' }, pending2]],
      ],
      [`${LIST}/p1/status`]: [
        [
          200,
          titleOf(media(4), { id: 'p1', mine: 'TOGETHER', view: 'TOGETHER' }),
        ],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/pending');

    expect(el('[data-test="swipe-tutorial"]').textContent).toContain(
      'Vers le haut',
    );
    el('[data-test="tutorial-ok"]').click();
    await settle();
    expect(localStorage.getItem('canapact.swipeTutorialSeen')).toBe('1');

    expect(el('[data-test="pending-count"]').textContent).toContain(
      '2 titres attendent votre avis',
    );
    expect(el('[data-test="swipe-card"]').textContent).toContain('Vidéo 4');

    el('[data-test="decide-TOGETHER"]').click();
    await new Promise((r) => setTimeout(r, 220));
    await settle();

    const [, init] = calls(fetchMock, `${LIST}/p1/status`)[0];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'TOGETHER' });
    await vi.waitFor(() =>
      expect(el('[data-test="swipe-card"]').textContent).toContain('Vidéo 5'),
    );
    expect(el('[data-test="pending-badge"]').textContent).toContain('1');
  });

  it('glisser la carte à droite : « sans moi, ok »', async () => {
    localStorage.setItem('canapact.swipeTutorialSeen', '1');
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [LIST]: [
        [200, [pending1]],
        [200, []],
      ],
      [`${LIST}/p1/status`]: [
        [200, titleOf(media(4), { id: 'p1', view: 'ALONE' })],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/pending');
    expect(document.querySelector('[data-test="swipe-tutorial"]')).toBeNull();

    const card = el('[data-test="swipe-card"]');
    const pointer = (type: string, clientX: number) =>
      card.dispatchEvent(
        new MouseEvent(type, {
          clientX,
          clientY: 100,
          button: 0,
          bubbles: true,
        }),
      );
    pointer('pointerdown', 100);
    pointer('pointermove', 180);
    await settle();
    expect(el('[data-test="swipe-hint"]').textContent).toContain(
      'Sans moi, ok',
    );
    pointer('pointermove', 260);
    pointer('pointerup', 260);
    await new Promise((r) => setTimeout(r, 220));
    await settle();

    const [, init] = calls(fetchMock, `${LIST}/p1/status`)[0];
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'OK_ALONE' });
    await vi.waitFor(() => el('[data-test="pending-done"]'));
  });

  it('toucher sa pastille pour changer d’avis', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [LIST]: [
        [200, [alone]],
        [200, []],
      ],
      [`${LIST}/a1/status`]: [
        [
          200,
          titleOf(media(1), {
            id: 'a1',
            mine: 'NOT_INTERESTED',
            view: 'HIDDEN',
          }),
        ],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/alone');

    el('[data-title="a1"] [data-test="my-status"]').click();
    await settle();
    el('[data-test="sheet-NOT_INTERESTED"]').click();
    await settle();

    const [, init] = calls(fetchMock, `${LIST}/a1/status`)[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      status: 'NOT_INTERESTED',
    });
    expect(ids('[data-test="titles"]')).toEqual([]);
  });

  it('« Je l’ai vu (seul) » le retire de mes listes, et s’annule', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [LIST]: [
        [200, [alone]],
        [200, []],
        [200, [alone]],
      ],
      [`${LIST}/a1/watched-alone`]: [
        [
          200,
          {
            ...alone,
            myWatchedAloneAt: '2026-11-22T22:00:00Z',
            view: 'HIDDEN',
          },
        ],
        [200, alone],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/alone');

    el('[data-title="a1"] [data-test="title-actions"]').click();
    await settle();
    el('[data-test="action-watched-alone"]').click();
    await settle();

    expect(calls(fetchMock, `${LIST}/a1/watched-alone`)[0][1]?.method).toBe(
      'PUT',
    );
    expect(ids('[data-test="titles"]')).toEqual([]);
    expect(el('[data-test="notice"]').textContent).toContain('Vu !');

    el('[data-test="undo"]').click();
    await settle();
    expect(calls(fetchMock, `${LIST}/a1/watched-alone`)[1][1]?.method).toBe(
      'DELETE',
    );
    await vi.waitFor(() => expect(ids('[data-test="titles"]')).toEqual(['a1']));
  });

  it('« On l’a vu ensemble » le sort des listes', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [LIST]: [
        [200, [together]],
        [200, []],
      ],
      [`${LIST}/e1/watched-together`]: [
        [
          200,
          {
            ...together,
            watchedTogetherAt: '2026-11-22T22:00:00Z',
            view: 'ARCHIVED',
          },
        ],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/together');

    el('[data-title="e1"] [data-test="title-actions"]').click();
    await settle();
    el('[data-test="action-watched-together"]').click();
    await settle();

    expect(calls(fetchMock, `${LIST}/e1/watched-together`)[0][1]?.method).toBe(
      'PUT',
    );
    expect(ids('[data-test="titles"]')).toEqual([]);
    expect(el('[data-test="notice"]').textContent).toContain('Vu ensemble');
  });

  it('recharge les listes au retour sur l’app', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [LIST]: [
        [200, [alone]],
        [200, [alone, together]],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/together');
    expect(ids('[data-test="titles"]')).toEqual([]);

    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(calls(fetchMock, LIST)).toHaveLength(2);
    expect(ids('[data-test="titles"]')).toEqual(['e1']);
  });

  it('historique : la date du « vu ensemble », et l’annulation', async () => {
    const watched = {
      ...together,
      watchedTogetherAt: '2026-11-21T21:00:00.000Z',
      view: 'ARCHIVED' as const,
    };
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      [`${LIST}/history`]: [
        [200, [watched]],
        [200, []],
      ],
      [LIST]: [[200, [together]]],
      [`${LIST}/e1/watched-together`]: [[200, together]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountApp('/history');

    expect(el('[data-test="reason"]').textContent).toBe(
      'Vu ensemble le 21 novembre',
    );
    el('[data-title="e1"] [data-test="title-actions"]').click();
    await settle();
    el('[data-test="action-undo-together"]').click();
    await settle();

    expect(calls(fetchMock, `${LIST}/e1/watched-together`)[0][1]?.method).toBe(
      'DELETE',
    );
    await vi.waitFor(() => el('[data-test="history-empty"]'));
  });

  it('le tuto se relance depuis le menu du compte', async () => {
    localStorage.setItem('canapact.swipeTutorialSeen', '1');
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        [LIST]: [[200, []]],
      }),
    );
    const { router } = await mountApp('/alone');

    el('[aria-label="Mon compte"]').click();
    await settle();
    el('[data-test="replay-tutorial"]').click();
    await settle();
    await vi.waitFor(() => el('[data-test="swipe-tutorial"]'));
    expect(router.currentRoute.value.name).toBe('pending');
  });
});
