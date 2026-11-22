// jsdom ne fournit pas ResizeObserver, utilisé par Vuetify.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/** Réponse JSON simulée pour les tests qui remplacent fetch. */
export function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const fakeUser = {
  id: 'u1',
  email: 'adrien@exemple.fr',
  displayName: 'Adrien',
  emailVerified: true,
};
