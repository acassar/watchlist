import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;
const nousDeux = {
  id: 'g1',
  name: 'Nous deux',
  role: 'OWNER',
  memberCount: 2,
  activeTitleCount: 47,
};
const detail = {
  ...nousDeux,
  createdAt: '',
  members: [
    { userId: fakeUser.id, displayName: 'Adrien', role: 'OWNER', joinedAt: '' },
  ],
};
const empty = {
  enabled: true,
  mine: null,
  linkedCount: 0,
  lastSyncedAt: null,
  nextManualSyncAt: null,
  waiting: 0,
};
const linked = {
  ...empty,
  mine: {
    playlistId: 'PLmine000000000000',
    url: 'https://www.youtube.com/playlist?list=PLmine000000000000',
    linkedAt: '2026-11-27T12:00:00Z',
    importExisting: true,
    error: null,
  },
  linkedCount: 1,
  lastSyncedAt: '2026-11-27T12:00:00Z',
  nextManualSyncAt: null,
  waiting: 2,
};
const skipped = { synced: false, added: 0, waiting: 0, state: empty };

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
  return wrapper;
}

function calls(fetchMock: ReturnType<typeof fetchByUrl>, url: string) {
  return (fetchMock.mock.calls as unknown as [string, RequestInit][])
    .filter(([u]) => u === url)
    .map(([, init]) => (init.body ? JSON.parse(init.body as string) : null));
}

describe('playlist YouTube du groupe', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('demande une synchro auto à l’ouverture, une seule fois', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1/titles': [[200, []]],
      '/api/groups/g1/playlists/sync': [[200, skipped]],
    });
    vi.stubGlobal('fetch', fetchMock);
    await mountAt('/alone');

    expect(calls(fetchMock, '/api/groups/g1/playlists/sync')).toEqual([
      { mode: 'auto' },
    ]);
    // Retour au premier plan juste après : pas de nouvel appel.
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(calls(fetchMock, '/api/groups/g1/playlists/sync')).toHaveLength(1);
  });

  it('sans playlist : tuto, puis liaison avec ou sans les vidéos déjà là', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/groups/g1': [[200, detail]],
      '/api/groups/g1/invitations': [[200, []]],
      '/api/groups/g1/playlists': [[200, empty]],
      '/api/groups/g1/playlists/sync': [[200, skipped]],
      '/api/groups/g1/playlists/mine': [
        [200, { synced: true, added: 3, waiting: 2, state: linked }],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = await mountAt('/groups/g1');

    const section = wrapper.find('[data-test="playlist-section"]');
    expect(section.exists()).toBe(true);
    expect(section.text()).toContain('Non répertoriée');
    // 47 titres en cours sur 50 : 3 places.
    expect(wrapper.find('[data-test="playlist-import-hint"]').text()).toContain(
      'Seules les 3 premières',
    );

    await wrapper
      .find('[data-test="playlist-url"] input')
      .setValue('https://www.youtube.com/playlist?list=PLmine000000000000');
    await wrapper.find('[data-test="playlist-import"] input').setValue(false);
    expect(wrapper.find('[data-test="playlist-import-hint"]').text()).toContain(
      'à partir de maintenant',
    );
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(calls(fetchMock, '/api/groups/g1/playlists/mine')).toEqual([
      {
        url: 'https://www.youtube.com/playlist?list=PLmine000000000000',
        importExisting: false,
      },
    ]);
    expect(section.text()).toContain('3 vidéos ajoutées');
    expect(section.text()).toContain('2 vidéos attendent une place');
    expect(wrapper.find('[data-test="playlist-tuto"]').exists()).toBe(false);
  });

  it('bouton « Synchroniser » désactivé jusqu’à l’heure permise', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        '/api/groups/g1': [[200, detail]],
        '/api/groups/g1/invitations': [[200, []]],
        '/api/groups/g1/playlists': [
          [
            200,
            {
              ...linked,
              nextManualSyncAt: new Date(Date.now() + 600_000).toISOString(),
            },
          ],
        ],
        '/api/groups/g1/playlists/sync': [[200, skipped]],
      }),
    );
    const wrapper = await mountAt('/groups/g1');
    const button = wrapper.find('[data-test="playlist-sync"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Prochaine synchro possible');
  });

  it('masquée si le serveur n’a pas de clé YouTube', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        '/api/groups/g1': [[200, detail]],
        '/api/groups/g1/invitations': [[200, []]],
        '/api/groups/g1/playlists': [[200, { ...empty, enabled: false }]],
        '/api/groups/g1/playlists/sync': [[200, skipped]],
      }),
    );
    const wrapper = await mountAt('/groups/g1');
    expect(wrapper.find('[data-test="playlist-section"]').exists()).toBe(false);
  });
});
