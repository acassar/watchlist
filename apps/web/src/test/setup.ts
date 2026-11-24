// jsdom ne fournit pas ResizeObserver, utilisé par Vuetify.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Ni visualViewport, utilisé par les fenêtres et panneaux de Vuetify.
if (!('visualViewport' in globalThis)) {
  Object.defineProperty(globalThis, 'visualViewport', {
    value: Object.assign(new EventTarget(), {
      width: 390,
      height: 844,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    }),
  });
}

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
  hasPassword: true,
  locale: 'fr' as const,
};

type Reply = readonly [status: number, body?: unknown];

/**
 * fetch simulé qui répond selon l'URL : pour chaque chemin, une liste de
 * réponses servies dans l'ordre (la dernière est répétée). `/api/auth/providers`
 * répond « pas de Google » par défaut.
 */
export function fetchByUrl(routes: Record<string, readonly Reply[]>) {
  const queues: Record<string, Reply[]> = {
    '/api/auth/providers': [[200, { google: false }]],
  };
  for (const [url, replies] of Object.entries(routes)) {
    queues[url] = [...replies];
  }
  return vi.fn((url: string) => {
    const queue = queues[url];
    if (!queue?.length) {
      return Promise.reject(new Error(`fetch inattendu : ${url}`));
    }
    const [status, body] = queue.length > 1 ? queue.shift()! : queue[0];
    return Promise.resolve(jsonResponse(status, body));
  });
}
