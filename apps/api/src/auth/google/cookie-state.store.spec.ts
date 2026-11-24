import type { Request, Response } from 'express';
import {
  CookieStateStore,
  type GoogleLoginState,
} from './cookie-state.store.js';

const SECRET = 'secret-de-test-secret-de-test-secret';

/** Requête minimale : cookies entrants et réponse qui enregistre les cookies posés. */
function fakeRequest(cookies: Record<string, string> = {}) {
  const set: Record<string, string> = {};
  const res = {
    cookie: (name: string, value: string) => {
      set[name] = value;
    },
    clearCookie: (name: string) => {
      set[name] = '';
    },
  } as unknown as Response;
  return { req: { cookies, res } as unknown as Request, set };
}

function storeState(
  store: CookieStateStore,
  state: GoogleLoginState = { next: '/together', locale: 'en' },
) {
  const { req, set } = fakeRequest();
  let handle = '';
  store.store(req, 'verifier-1', state, {}, (_err, h) => {
    handle = h!;
  });
  return { handle, cookie: set.canapact_oauth };
}

function verify(store: CookieStateStore, cookie: string, handle: unknown) {
  const { req, set } = fakeRequest({ canapact_oauth: cookie });
  let result: { ok: string | false; state?: unknown } = { ok: false };
  store.verify(req, handle, (_err, ok, state) => {
    result = { ok, state };
  });
  return { ...result, cleared: set.canapact_oauth === '' };
}

describe('CookieStateStore', () => {
  const store = new CookieStateStore(SECRET, true);

  it('rend le vérificateur, le chemin de retour et la langue au bon state', () => {
    const { handle, cookie } = storeState(store);
    const result = verify(store, cookie, handle);
    expect(result.ok).toBe('verifier-1');
    expect(result.state as GoogleLoginState).toEqual({
      next: '/together',
      locale: 'en',
    });
    expect(result.cleared).toBe(true);
  });

  it('refuse un autre state', () => {
    const { cookie } = storeState(store);
    expect(verify(store, cookie, 'autre').ok).toBe(false);
    expect(verify(store, cookie, undefined).ok).toBe(false);
  });

  it('refuse un cookie modifié ou signé avec un autre secret', () => {
    const { handle, cookie } = storeState(store);
    const [payload, signature] = cookie.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        next: '/ailleurs',
      }),
    ).toString('base64url');
    expect(verify(store, `${forged}.${signature}`, handle).ok).toBe(false);

    const other = new CookieStateStore(`${SECRET}-autre`, true);
    expect(verify(other, cookie, handle).ok).toBe(false);
    expect(verify(store, 'pas-un-cookie', handle).ok).toBe(false);
  });

  it('refuse un état expiré', () => {
    vi.useFakeTimers();
    try {
      const { handle, cookie } = storeState(store);
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(verify(store, cookie, handle).ok).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
