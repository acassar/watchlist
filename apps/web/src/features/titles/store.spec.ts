import type { GroupTitle } from '@watchlist/shared';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/features/auth/store';
import { fakeUser } from '@/test/setup';
import { media, titleOf } from '@/test/titles';
import { titlesApi } from './api';
import { useTitlesStore } from './store';

vi.mock('./api', () => ({
  titlesApi: { list: vi.fn(), history: vi.fn(), setStatus: vi.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const p1 = titleOf(media(1), { id: 'p1', mine: 'PENDING', view: 'PENDING' });
const p2 = titleOf(media(2), { id: 'p2', mine: 'PENDING', view: 'PENDING' });
const done = (t: GroupTitle): GroupTitle => ({
  ...t,
  myStatus: 'OK_ALONE',
  view: 'ALONE',
});

describe('store des titres', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = fakeUser;
    vi.mocked(titlesApi.list).mockReset();
    vi.mocked(titlesApi.setStatus).mockReset();
  });

  it('une liste lue pendant une autre action ne fait pas revenir une carte glissée', async () => {
    const store = useTitlesStore();
    vi.mocked(titlesApi.list).mockResolvedValueOnce([p1, p2]);
    await store.load('g1');

    // Premier swipe : l'API répond vite.
    vi.mocked(titlesApi.setStatus).mockResolvedValueOnce(done(p1));
    // Second swipe : l'API traîne.
    const second = deferred<GroupTitle>();
    vi.mocked(titlesApi.setStatus).mockReturnValueOnce(second.promise);

    const first = store.setStatus(p1, 'OK_ALONE');
    const other = store.setStatus(p2, 'OK_ALONE');
    await first;
    // Rechargement (retour sur l'app) lu avant que le second avis soit enregistré.
    vi.mocked(titlesApi.list).mockResolvedValueOnce([done(p1), p2]);
    store.refresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.byView.PENDING).toEqual([]);

    vi.mocked(titlesApi.list).mockResolvedValueOnce([done(p1), done(p2)]);
    second.resolve(done(p2));
    await other;
    await new Promise((r) => setTimeout(r, 0));
    expect(store.byView.PENDING).toEqual([]);
    expect(store.byView.ALONE.map((t) => t.id).sort()).toEqual(['p1', 'p2']);
  });
});
