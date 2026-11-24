import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';
import { useGroupsStore } from '../store';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;
const anonymous = [401, { code: 'UNAUTHENTICATED' }] as const;
const nousDeux = {
  id: 'g1',
  name: 'Nous deux',
  role: 'OWNER',
  memberCount: 2,
  activeTitleCount: 0,
};
const coloc = {
  id: 'g2',
  name: 'Coloc Rivoli',
  role: 'MEMBER',
  memberCount: 3,
  activeTitleCount: 0,
};

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

/** Corps JSON envoyé à une URL (dernier appel). */
function sentTo(fetchMock: ReturnType<typeof fetchByUrl>, url: string) {
  const call = fetchMock.mock.calls
    .filter(([u]) => u === url)
    .at(-1) as unknown as [string, RequestInit] | undefined;
  return call ? JSON.parse(call[1].body as string) : undefined;
}

function click(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Introuvable : ${selector}`);
  el.click();
}

describe('groupes (écrans)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('sans groupe : propose d’en créer un ou d’en rejoindre un', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
      }),
    );
    const { wrapper } = await mountAt('/');

    expect(wrapper.find('[data-test="no-group"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Créer un groupe');
    expect(wrapper.find('[data-test="group-switcher"]').exists()).toBe(false);
  });

  it('affiche le groupe actif en haut et change de groupe depuis le panneau', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux, coloc]]],
      }),
    );
    const { wrapper } = await mountAt('/');
    const switcher = wrapper.find('[data-test="group-switcher"]');
    expect(switcher.text()).toContain('Coloc Rivoli');

    await switcher.trigger('click');
    await settle();
    const sheet = document.querySelector('[data-test="group-sheet"]');
    expect(sheet?.textContent).toContain('Vos groupes');
    expect(sheet?.textContent).toContain('Nous deux');
    expect(sheet?.textContent).toContain('2 membres');
    // Déjà à la limite d'un groupe : on explique au lieu de proposer.
    expect(sheet?.textContent).toContain('Un canapé à la fois');
    expect(sheet?.textContent).not.toContain('Rejoindre');

    const rows = [...document.querySelectorAll<HTMLElement>('.group-pick')];
    rows.find((r) => r.textContent?.includes('Nous deux'))!.click();
    await settle();

    expect(useGroupsStore().activeGroup?.id).toBe('g1');
    expect(wrapper.find('[data-test="group-switcher"]').text()).toContain(
      'Nous deux',
    );
  });

  it('déjà dans un groupe : la création explique la limite', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
      }),
    );
    const { wrapper } = await mountAt('/groups/new');
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Un canapé à la fois'),
    );
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('crée un groupe puis ouvre sa page pour inviter', async () => {
    const created = {
      ...nousDeux,
      memberCount: 1,
      createdAt: '2026-11-22T20:00:00Z',
      members: [
        {
          userId: fakeUser.id,
          displayName: 'Adrien',
          role: 'OWNER',
          joinedAt: '',
        },
      ],
    };
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [
        [200, []],
        [201, created],
      ],
      '/api/groups/g1': [[200, created]],
      '/api/groups/g1/invitations': [[200, []]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper, router } = await mountAt('/groups/new');

    await wrapper.find('input').setValue('  Nous deux ');
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(sentTo(fetchMock, '/api/groups')).toEqual({ name: 'Nous deux' });
    await vi.waitFor(() => expect(wrapper.text()).toContain('Groupe créé'));
    expect(router.currentRoute.value.name).toBe('group');
    expect(wrapper.text()).toContain('Inviter quelqu');
  });

  it('page du groupe : invite et montre le lien et le code', async () => {
    const detail = {
      ...nousDeux,
      createdAt: '',
      members: [
        {
          userId: fakeUser.id,
          displayName: 'Adrien',
          role: 'OWNER',
          joinedAt: '',
        },
        { userId: 'u2', displayName: 'Camille', role: 'MEMBER', joinedAt: '' },
      ],
    };
    const invitation = {
      id: 'i1',
      code: 'ABCDEFGH',
      expiresAt: '2026-11-29T20:00:00Z',
      uses: 0,
      maxUses: null,
      createdAt: '',
      createdBy: { userId: fakeUser.id, displayName: 'Adrien' },
      url: 'http://localhost/join#token=secret',
    };
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux]]],
        '/api/groups/g1': [[200, detail]],
        '/api/groups/g1/invitations': [
          [200, []],
          [201, invitation],
        ],
      }),
    );
    const { wrapper } = await mountAt('/groups/g1');

    const members = wrapper.findAll('[data-test="member"]');
    expect(members.map((m) => m.text())).toEqual([
      expect.stringContaining('Adrien (vous)'),
      expect.stringContaining('Camille'),
    ]);
    expect(members[0].text()).toContain('Propriétaire');

    await wrapper.find('[data-test="invite"]').trigger('click');
    await settle();

    const dialog = document.querySelector('[data-test="invite-dialog"]');
    expect(dialog?.textContent).toContain('ABCD-EFGH');
    expect(dialog?.textContent).toContain('29 novembre');
    expect(
      document.querySelector<HTMLInputElement>(
        '[data-test="invite-link"] input',
      )?.value,
    ).toBe('http://localhost/join#token=secret');
    expect(wrapper.findAll('[data-test="invitation"]')).toHaveLength(1);
  });

  it('quitter : explique la passation puis revient aux listes', async () => {
    const detail = {
      ...nousDeux,
      createdAt: '',
      members: [
        {
          userId: fakeUser.id,
          displayName: 'Adrien',
          role: 'OWNER',
          joinedAt: '',
        },
        { userId: 'u2', displayName: 'Camille', role: 'MEMBER', joinedAt: '' },
      ],
    };
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [nousDeux, coloc]]],
        '/api/groups/g1': [[200, detail]],
        '/api/groups/g1/invitations': [[200, []]],
        '/api/groups/g1/leave': [[204]],
      }),
    );
    const { wrapper, router } = await mountAt('/groups/g1');

    await wrapper.find('[data-test="leave"]').trigger('click');
    await settle();
    expect(
      document.querySelector('[data-test="confirm-dialog"]')?.textContent,
    ).toContain('Camille deviendra propriétaire');

    click('[data-test="confirm"]');
    await settle();

    expect(router.currentRoute.value.path).toBe('/alone');
    expect(useGroupsStore().groups.map((g) => g.id)).toEqual(['g2']);
  });

  it('lien d’invitation sans compte : le garde et propose de s’inscrire', async () => {
    vi.stubGlobal('fetch', fetchByUrl({ '/api/auth/refresh': [anonymous] }));
    const { wrapper, router } = await mountAt('/join#token=secret');

    expect(router.currentRoute.value.hash).toBe('');
    expect(wrapper.text()).toContain('Créez un compte ou connectez-vous');
    expect(localStorage.getItem('canapact.pendingInvite')).toContain('secret');
  });

  it('déjà dans un groupe : l’invitation explique la limite au lieu de rejoindre', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, [coloc]]],
        '/api/invitations/preview': [
          [
            200,
            {
              groupId: 'g1',
              groupName: 'Nous deux',
              memberCount: 1,
              invitedBy: 'Camille',
              alreadyMember: false,
            },
          ],
        ],
      }),
    );
    const { wrapper } = await mountAt('/join#token=secret');
    await vi.waitFor(() =>
      expect(wrapper.find('[data-test="group-limit"]').exists()).toBe(true),
    );
    expect(wrapper.find('[data-test="accept"]').exists()).toBe(false);
  });

  it('une fois connecté, revient sur l’invitation gardée et rejoint le groupe', async () => {
    localStorage.setItem(
      'canapact.pendingInvite',
      JSON.stringify({ token: 'secret', at: Date.now() }),
    );
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, []]],
      '/api/invitations/preview': [
        [
          200,
          {
            groupId: 'g1',
            groupName: 'Nous deux',
            memberCount: 1,
            invitedBy: 'Camille',
            alreadyMember: false,
          },
        ],
      ],
      '/api/invitations/accept': [[200, { ...nousDeux, role: 'MEMBER' }]],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper, router } = await mountAt('/');

    expect(router.currentRoute.value.name).toBe('join');
    expect(wrapper.text()).toContain('Camille vous invite à rejoindre');
    expect(wrapper.text()).toContain('Nous deux');

    await wrapper.find('[data-test="accept"]').trigger('click');
    await settle();

    expect(sentTo(fetchMock, '/api/invitations/accept')).toEqual({
      token: 'secret',
    });
    expect(router.currentRoute.value.name).toBe('alone');
    expect(useGroupsStore().activeGroup?.id).toBe('g1');
    expect(localStorage.getItem('canapact.pendingInvite')).toBeNull();
  });

  it('code invalide : affiche l’erreur de l’API', async () => {
    const fetchMock = fetchByUrl({
      '/api/auth/refresh': [session],
      '/api/groups': [[200, [nousDeux]]],
      '/api/invitations/preview': [
        [404, { code: 'INVITATION_INVALID', message: 'x' }],
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = await mountAt('/join');

    await wrapper.find('input').setValue('abcd-efgh');
    await wrapper.find('form').trigger('submit');
    await settle();

    expect(sentTo(fetchMock, '/api/invitations/preview')).toEqual({
      code: 'ABCDEFGH',
    });
    expect(wrapper.text()).toContain('invalide, expirée ou révoquée');
  });
});
