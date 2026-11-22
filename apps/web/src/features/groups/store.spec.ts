import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/features/auth/store';
import { fakeUser, fetchByUrl } from '@/test/setup';
import { useGroupsStore } from './store';

const nousDeux = { id: 'g1', name: 'Nous deux', role: 'OWNER', memberCount: 2 };
const coloc = { id: 'g2', name: 'Coloc', role: 'MEMBER', memberCount: 3 };

describe('store des groupes', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    const auth = useAuthStore();
    auth.applySession({ accessToken: 'jwt', user: fakeUser });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('charge mes groupes triés et prend le premier comme groupe actif', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({ '/api/groups': [[200, [nousDeux, coloc]]] }),
    );
    const groups = useGroupsStore();

    await groups.load();

    expect(groups.groups.map((g) => g.name)).toEqual(['Coloc', 'Nous deux']);
    expect(groups.activeGroup?.id).toBe('g2');
    expect(groups.hasNoGroup).toBe(false);
  });

  it('retient le dernier groupe ouvert sur l’appareil, par utilisateur', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({ '/api/groups': [[200, [nousDeux, coloc]]] }),
    );
    useGroupsStore().select('g1');

    setActivePinia(createPinia());
    useAuthStore().applySession({ accessToken: 'jwt', user: fakeUser });
    const groups = useGroupsStore();
    await groups.load();

    expect(groups.activeGroup?.id).toBe('g1');
    expect(localStorage.getItem(`canapact.activeGroup.${fakeUser.id}`)).toBe(
      'g1',
    );
  });

  it('ignore un groupe retenu dont je ne fais plus partie', async () => {
    localStorage.setItem(`canapact.activeGroup.${fakeUser.id}`, 'disparu');
    vi.stubGlobal('fetch', fetchByUrl({ '/api/groups': [[200, [nousDeux]]] }));
    const groups = useGroupsStore();
    await groups.load();
    expect(groups.activeGroup?.id).toBe('g1');
  });

  it('signale l’absence de groupe une fois la liste chargée', async () => {
    vi.stubGlobal('fetch', fetchByUrl({ '/api/groups': [[200, []]] }));
    const groups = useGroupsStore();
    expect(groups.hasNoGroup).toBe(false);
    await groups.load();
    expect(groups.hasNoGroup).toBe(true);
  });

  it('un groupe créé devient le groupe actif', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/groups': [
          [201, { ...nousDeux, memberCount: 1, members: [], createdAt: '' }],
        ],
      }),
    );
    const groups = useGroupsStore();
    await groups.create('Nous deux');
    expect(groups.groups).toEqual([{ ...nousDeux, memberCount: 1 }]);
    expect(groups.activeGroup?.id).toBe('g1');
  });

  it('quitter le groupe actif bascule sur un autre', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/groups': [[200, [nousDeux, coloc]]],
        '/api/groups/g1/leave': [[204]],
      }),
    );
    const groups = useGroupsStore();
    await groups.load();
    groups.select('g1');

    await groups.leave('g1');

    expect(groups.groups.map((g) => g.id)).toEqual(['g2']);
    expect(groups.activeGroup?.id).toBe('g2');
  });
});
