import { createPinia, setActivePinia } from 'pinia';
import { api } from '@/api/http';
import { fakeUser, jsonResponse } from '@/test/setup';
import { useAuthStore } from './store';

describe('session (store d’auth + client HTTP)', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it('restaure la session au démarrage grâce au cookie de refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { accessToken: 'jwt', user: fakeUser }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const auth = useAuthStore();

    await auth.init();
    await auth.init();

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.displayName).toBe('Adrien');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
  });

  it('passe en anonyme si aucune session n’existe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: 'UNAUTHENTICATED' })),
    );
    const auth = useAuthStore();
    await auth.init();
    expect(auth.status).toBe('anonymous');
  });

  it('envoie le JWT, rafraîchit une fois sur 401 puis rejoue la requête', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'UNAUTHENTICATED' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'nouveau', user: fakeUser }),
      )
      .mockResolvedValueOnce(jsonResponse(200, fakeUser));
    vi.stubGlobal('fetch', fetchMock);
    const auth = useAuthStore();
    auth.applySession({ accessToken: 'expiré', user: fakeUser });

    const me = await api('/me');

    expect(me).toEqual(fakeUser);
    const headers = (call: number) =>
      (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<
        string,
        string
      >;
    expect(headers(0).authorization).toBe('Bearer expiré');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(headers(2).authorization).toBe('Bearer nouveau');
  });

  it('ne lance qu’un refresh pour plusieurs 401 simultanés', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url === '/api/auth/refresh'
          ? jsonResponse(200, { accessToken: 'nouveau', user: fakeUser })
          : jsonResponse(401, { code: 'UNAUTHENTICATED' }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const auth = useAuthStore();

    await Promise.all([auth.refresh(), auth.refresh(), auth.refresh()]);

    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh'),
    ).toHaveLength(1);
  });

  it('se déconnecte même si l’API ne répond pas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const auth = useAuthStore();
    auth.applySession({ accessToken: 'jwt', user: fakeUser });

    await auth.logout().catch(() => undefined);

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.accessToken).toBeNull();
  });
});
